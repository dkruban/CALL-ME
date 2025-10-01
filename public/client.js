document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    let localStream;
    let remoteStream;
    let peerConnection;
    let currentNumber = null;
    let selectedUserId = null;
    let isCallActive = false;
    let isMuted = false;
    
    // WebRTC configuration
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };
    
    // DOM elements
    const numberButtons = document.querySelectorAll('.number-btn');
    const callControls = document.querySelector('.call-controls');
    const currentNumberSpan = document.getElementById('current-number');
    const statusDiv = document.getElementById('status');
    const usersList = document.getElementById('users-list');
    const callBtn = document.getElementById('call-btn');
    const hangupBtn = document.getElementById('hangup-btn');
    const muteBtn = document.getElementById('mute-btn');
    const unmuteBtn = document.getElementById('unmute-btn');
    
    // Handle number selection
    numberButtons.forEach(button => {
        button.addEventListener('click', () => {
            const number = button.getAttribute('data-number');
            currentNumber = number;
            currentNumberSpan.textContent = number;
            
            // Show call controls
            document.querySelector('.number-selection').style.display = 'none';
            callControls.style.display = 'block';
            
            // Join the room
            socket.emit('join-room', number);
        });
    });
    
    // Handle user joined event
    socket.on('user-joined', (userId) => {
        statusDiv.textContent = 'New user joined. You can now make a call.';
        updateUsersList();
    });
    
    // Handle user left event
    socket.on('user-left', (userId) => {
        statusDiv.textContent = 'User left the room.';
        updateUsersList();
        
        // If we were in a call with this user, end the call
        if (isCallActive) {
            endCall();
        }
    });
    
    // Update users list
    function updateUsersList() {
        // This is a simplified version. In a real app, you'd maintain a list of users
        // For now, we'll just show a placeholder
        usersList.innerHTML = '<li>Available user (click to select)</li>';
        
        // Add click event to select a user
        const userItems = usersList.querySelectorAll('li');
        userItems.forEach(item => {
            item.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('#users-list li').forEach(li => {
                    li.classList.remove('selected');
                });
                
                // Select this user
                item.classList.add('selected');
                selectedUserId = 'user-id'; // In a real app, this would be the actual user ID
                callBtn.disabled = false;
            });
        });
    }
    
    // Initialize a call
    async function initializeCall() {
        try {
            // Get local media stream
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            // Create peer connection
            peerConnection = new RTCPeerConnection(configuration);
            
            // Add local stream to peer connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Handle remote stream
            peerConnection.ontrack = (event) => {
                remoteStream = event.streams[0];
                // In a real app, you would play this remote stream
                // For this example, we're just establishing the connection
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice-candidate', {
                        target: selectedUserId,
                        candidate: event.candidate
                    });
                }
            };
            
            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            socket.emit('offer', {
                target: selectedUserId,
                offer: offer
            });
            
            statusDiv.textContent = 'Calling...';
            isCallActive = true;
            callBtn.disabled = true;
            hangupBtn.disabled = false;
            muteBtn.disabled = false;
            unmuteBtn.disabled = true;
            
        } catch (error) {
            console.error('Error initializing call:', error);
            statusDiv.textContent = 'Error: Could not initialize call.';
        }
    }
    
    // Handle incoming offer
    socket.on('offer', async (data) => {
        try {
            // Get local media stream if not already available
            if (!localStream) {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            }
            
            // Create peer connection if not already created
            if (!peerConnection) {
                peerConnection = new RTCPeerConnection(configuration);
                
                // Add local stream to peer connection
                localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, localStream);
                });
                
                // Handle remote stream
                peerConnection.ontrack = (event) => {
                    remoteStream = event.streams[0];
                    // In a real app, you would play this remote stream
                };
                
                // Handle ICE candidates
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('ice-candidate', {
                            target: data.sender,
                            candidate: event.candidate
                        });
                    }
                };
            }
            
            // Set remote description
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            // Create and send answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            socket.emit('answer', {
                target: data.sender,
                answer: answer
            });
            
            statusDiv.textContent = 'In a call...';
            isCallActive = true;
            callBtn.disabled = true;
            hangupBtn.disabled = false;
            muteBtn.disabled = false;
            unmuteBtn.disabled = true;
            
        } catch (error) {
            console.error('Error handling offer:', error);
            statusDiv.textContent = 'Error: Could not handle incoming call.';
        }
    });
    
    // Handle incoming answer
    socket.on('answer', async (data) => {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            statusDiv.textContent = 'Call connected.';
        } catch (error) {
            console.error('Error handling answer:', error);
            statusDiv.textContent = 'Error: Could not connect call.';
        }
    });
    
    // Handle incoming ICE candidates
    socket.on('ice-candidate', async (data) => {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    });
    
    // Call button click event
    callBtn.addEventListener('click', initializeCall);
    
    // Hang up button click event
    hangupBtn.addEventListener('click', endCall);
    
    // Mute button click event
    muteBtn.addEventListener('click', () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
            isMuted = true;
            muteBtn.disabled = true;
            unmuteBtn.disabled = false;
            statusDiv.textContent = 'Muted';
        }
    });
    
    // Unmute button click event
    unmuteBtn.addEventListener('click', () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
            isMuted = false;
            muteBtn.disabled = false;
            unmuteBtn.disabled = true;
            statusDiv.textContent = 'Unmuted';
        }
    });
    
    // End call function
    function endCall() {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
            localStream = null;
        }
        
        isCallActive = false;
        isMuted = false;
        callBtn.disabled = false;
        hangupBtn.disabled = true;
        muteBtn.disabled = true;
        unmuteBtn.disabled = true;
        statusDiv.textContent = 'Call ended.';
    }
});
