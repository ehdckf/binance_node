/* eslint-disable no-unused-vars */
const Pool = require("./pool");
const config = require("./config");
const { timeout_sec, n_conn, host, port } = config.inst().redis;
const { createClient } = require("redis");
const path = require("path");

class Redis {
        static root_key = "BINANCESTREAM";
        constructor() {
                this.redis = createClient(port, host);
                this.redis.on("connect", () => {
                        console.log("Redis Connected");
                });

                this.redis.on("reconnecting", () => {
                        console.log("Redis Reconnect!");
                });

                this.redis.on("errer", (e) => {
                        console.log("Redis Client Error:" + e);
                });

                this.redis.on("end", () => {
                        console.log("Redis Ended");
                        setTimeout(this.connect(), 1000);
                });
        }

        async connect() {
                return await this.redis.connect();
        }

        static key(id) {
                return path.join(Redis.root_key, id);
        }

        async set(...args) {
                // eslint-disable-next-line no-unused-vars
                let [key, value, _option] = args;
                key = Redis.key(`${key}`);
                const option = {};
                option.EX = timeout_sec;

                // _option = _option || {};
                // Object.keys(_option).forEach((k) => {
                //   //EX: 지정한 시간 이후에 데이터 지워짐 (s);
                //   // PX: 지정한 시간 이후에 데이터 지워짐 (ms);
                //   // EXAT: 지정한 시각이후에 데이터 지워짐(s);
                //   // PXAT: 지정한 시각이후에 데이터 지워짐(ms);
                //   // KEEPTTL: 만료시간 유지
                //   if (["PX", "EXAT", "PXAT", "KEEPTTL"].includes(k)) return;
                //   option[k] = _option?.[k];
                // });

                return await this.redis.set(key, value, option);
        }

        async get(...args) {
                let [key] = args;
                key = Redis.key(`${key}`);
                return await this.redis.get(key);
        }
}

// const RedisPool = new Pool(
//   n_conn,
//   () => new Redis(),
//   async (c) => {
//     await c.connect();
//   }
// );

module.exports = Redis;
