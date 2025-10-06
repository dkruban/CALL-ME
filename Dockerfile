# Use official Rust image with stable Rust
FROM rust:1.90

# Install system dependencies required by libdbus-sys
RUN apt-get update && apt-get install -y \
    pkg-config \
    libdbus-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy all project files into the container
COPY . .

# Build the CLI crate (callme-cli)
RUN cargo build --release -p callme-cli

# Set the command to run the built binary
CMD ["./target/release/callme-cli"]
