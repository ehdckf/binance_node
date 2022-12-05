const { WebSocket } = require("ws");
const Redis = require("./redis");
const config = require("./config");

class BinanceSocket {
        constructor(key) {
                this.redis = new Redis();
                this.key = key;
                this.init();
        }

        async init() {
                await this.redis_connect();
                this.socket_connect();
        }

        async redis_connect() {
                await this.redis.connect();
        }

        async socket_connect() {
                this.socket = new WebSocket(
                        `wss://stream.binance.com:9443/ws/${this.key}@trade`
                );

                this.socket.on("connection", () => {
                        // console.log(this.key + " Socket Connected");
                });

                this.socket.on("message", (stream) => {
                        try {
                                const p = JSON.parse(stream.toString()).p;
                                console.log(this.key + " " + p);

                                this.redis.set(this.key, p);
                        } catch (e) {
                                console.log(e);
                        }
                });

                this.socket.on("error", (err) => {
                        // console.log(this.key + " Socket Error!");
                        console.log(err);
                        this.socket.close();
                });

                this.socket.on("close", () => {
                        console.log(this.key + " Socket Closed");
                        setTimeout(() => {
                                this.socket_connect();
                        }, 1000);
                });

                this.socket.on("open", () => {
                        console.log(this.key + " Socket Opened!");
                });
        }
}

if (require.main === module) {
        (async () => {
                config.inst().binanceKey.map((v) => new BinanceSocket(v));
        })();
}
