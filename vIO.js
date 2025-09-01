class vIO {
    constructor(options = {}) {
        this.roomID = options.roomID || crypto.randomUUID();
        this.id = crypto.randomUUID().substring(0, 8);
        this.connected = false;
        this.peers = new Map();
        this.eventHandlers = new Map();
        
        this.createFrame(options);
        
        window.addEventListener("message", (e) => this.handleMessage(e));
        
        this.iframe.onload = () => {
                this.connected = true;
                this.emit('connect');
        };
    }


    createFrame(options) {
        if (!options.id) { throw new Error("id is required"); }
        if (!options.roomID) { throw new Error("roomID is required"); }

        this.iframe = document.createElement("iframe");
        this.iframe.src = `https://vdo.ninja/?room=${options.roomID}&cleanish&dataonly&autostart`;
        this.iframe.allow = "camera;microphone;fullscreen;display-capture;autoplay;camera=self;microphone=self;";
        this.iframe.style.width = "0px";
        this.iframe.style.height = "0px";
        this.iframe.style.top = "-100px";
        this.iframe.style.left = "-100px";
        this.iframe.id = options.id;
        document.body.appendChild(this.iframe);
    }
    emit(event, data = null, targetId = null) {
        const message = {
            event: event,
            data: data,
            from: this.id,
            timestamp: Date.now()
        };


        if (targetId) {
            this.iframe.contentWindow.postMessage({
                sendData: { vIO: message },
                type: "pcs",
                UUID: targetId
            }, "*");
        } else {
            this.iframe.contentWindow.postMessage({
                sendData: { vIO: message },
                type: "pcs"
            }, "*");
        }
    }

    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(callback);
    }

    off(event, callback = null) {
        if (!this.eventHandlers.has(event)) return;
        
        if (callback) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(callback);
            if (index > -1) handlers.splice(index, 1);
        } else {
            this.eventHandlers.delete(event);
        }
    }

    handleMessage(e) {
        if (e.source !== this.iframe.contentWindow) return;

        if (e.data.action === "guest-connected" && e.data.streamID) {
            const peerInfo = {
                id: e.data.streamID,
                label: e.data.value?.label || "Guest",
                connected: true
            };
            this.peers.set(e.data.streamID, peerInfo);
            this.trigger('peer-connected', peerInfo);
        }

        if (e.data.action === "guest-disconnected" && e.data.streamID) {
            const peerInfo = this.peers.get(e.data.streamID);
            if (peerInfo) {
                peerInfo.connected = false;
                this.trigger('peer-disconnected', peerInfo);
            }
        }

        if (e.data.dataReceived && e.data.dataReceived.vIO) {
            const message = e.data.dataReceived.vIO;
            this.trigger(message.event, message.data, message.from);
        }
    }

    trigger(event, data = null, from = null) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(callback => {
                if (from) {
                    callback(data, from);
                } else {
                    callback(data);
                }
            });
        }
    }

    getPeers() {
        return Array.from(this.peers.values()).filter(peer => peer.connected);
    }
    disconnect() {
        this.connected = false;
        this.emit('disconnect');
    }
}