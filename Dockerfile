# Start from an Ubuntu base image
FROM ubuntu:latest

# Update and install necessary packages (Python, Java, C++, Node.js)
RUN apt update && apt install -y \
    python3 python3-pip \
    default-jre \
    gcc g++ \
    nodejs npm

# Set the working directory inside the container
WORKDIR /app

# Copy the package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all project files into the container
COPY . .

# Expose port (depending on your app)
EXPOSE 3000

# Command to start your app
CMD ["node", "server.js"]
