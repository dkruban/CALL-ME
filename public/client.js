document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    let localStream;
    let peerConnection;
    let currentNumber = null;
    let selectedUserId = null;
    let isCallActive = false;
    
    // --- IMPORTANT: CONFIGURE YOUR TURN SERVER HERE ---
    // Replace with your actual TURN server credentials from a service like Twilio or Xirsys.
    // For testing, you can leave it with just the STUN server, but it will fail for many users.
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // {
            //     urls: 'turn:your-turn-server.com:3478',
            //     username: 'your-username',
            //     credential: 'your-credential'
            // }
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
    const remoteAudio = document.getElementById('remoteAudio'); // The audio element

    // Handle number selection
    numberButtons.forEach(button => {
        button.addEventListener('click', () => {
            const number = button.getAttribute('data-number');
            currentNumber = number;
            currentNumberSpan.textContent = number;
            
            document.querySelector('.number-selection').style.display = 'none';
            callControls.style.display = 'block';
            
            socket.emit('join-room', number);
        });
    });

    // --- Socket Event Handlers ---

    // Update the list of available users in the room
    socket.on('update-users-list', (users) => {
        usersList.innerHTML = ''; // Clear current list
        users.forEach(user => {
            // Don't show the current user in the list
            if (user.id !== socket.id) {
                const li = document.createElement('li');
                li.textContent = `User ${user.id.substring(0, 5)}...`;
                li.dataset.userId = user.id;
                li.addEventListener('click', selectUser);
                usersList.appendChild(li);
            }
        });
        statusDiv.textContent = users.length > 1 ? 'Select a user to call.' : 'Waiting for other users...';
    });

    socket.on('user-joined', (userId) => {
        statusDiv.textContent = `User ${userId.substring(0,5)}... joined.`;
    });

    socket.on('user-left', (userId) => {
        statusDiv.textContent = `User ${userId.substring(0,5)}... left.`;
        if (selectedUserId === userId) {
            endCall();
        }
    });

    // --- WebRTC Signaling ---

    socket.on('offer', async (data) => {
        if (!localStream) {
            await getLocalMedia();
        }
        await createPeerConnection();
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', { target: data.sender, answer: answer });
        
        isCallActive = true;
        updateCallUI(true);
        statusDiv.textContent = 'In a call...';
    });

    socket.on('answer', async (data) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        statusDiv.textContent = 'Call connected.';
    });

    socket.on('ice-candidate', async (data) => {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });

    // --- UI and Call Logic Functions ---

    function selectUser(event) {
        document.querySelectorAll('#users-list li').forEach(li => li.classList.remove('selected'));
        event.target.classList.add('selected');
        selectedUserId = event.target.dataset.userId;
        callBtn.disabled = false;
    }

    async function getLocalMedia() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (error) {
            console.error('Error getting media:', error);
            statusDiv.textContent = 'Error: Could not access microphone.';
        }
    }

    async function createPeerConnection() {
        peerConnection = new RTCPeerConnection(configuration);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            remoteAudio.srcObject = remoteStream; // Play the remote audio
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { target: selectedUserId, candidate: event.candidate });
            }
        };
    }

    async function initializeCall() {
        if (!selectedUserId) return;
        
        await getLocalMedia();
        await createPeerConnection();
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('offer', { target: selectedUserId, offer: offer });
        
        isCallActive = true;
        updateCallUI(true);
        statusDiv.textContent = 'Calling...';
    }

    function endCall() {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        remoteAudio.srcObject = null; // Stop remote audio
        
        isCallActive = false;
        selectedUserId = null;
        updateCallUI(false);
        statusDiv.textContent = 'Call ended.';
    }

    function updateCallUI(inCall) {
        callBtn.disabled = inCall;
        hangupBtn.disabled = !inCall;
        muteBtn.disabled = !inCall;
        unmuteBtn.disabled = !inCall;
        document.querySelectorAll('#users-list li').forEach(li => {
            li.style.pointerEvents = inCall ? 'none' : 'auto';
        });
    }

    // --- Event Listeners ---
    callBtn.addEventListener('click', initializeCall);
    hangupBtn.addEventListener('click', endCall);

    muteBtn.addEventListener('click', () => {
        localStream.getAudioTracks().forEach(track => track.enabled = false);
        muteBtn.disabled = true;
        unmuteBtn.disabled = false;
        statusDiv.textContent = 'Muted';
    });

    unmuteBtn.addEventListener('click', () => {
        localStream.getAudioTracks().forEach(track => track.enabled = true);
        muteBtn.disabled = false;
        unmuteBtn.disabled = true;
        statusDiv.textContent = 'Unmuted';
    });
});
