"use strict";
const RedisPool = require("../src/redis");

async function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
        (async () => {
                let redis = await RedisPool.get();
                try {
                        await redis.set("kill", "bill", { EX: 2 });
                        await sleep(1000);
                        let data = await redis.get("kill");
                        console.log(data);
                        await sleep(2000);
                        data = await redis.get("kill");
                        console.log(data);
                } catch (e) {
                        console.log(e);
                } finally {
                        if (redis) RedisPool.put(redis);
                }
        })();
}
