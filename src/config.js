"use strict";

const path = require("path");
const fs = require("fs");

// TODO: make properties ro
class config_t {
        constructor(conf) {
                Object.assign(this, conf);

                this.redis.timeout_sec = (this.redis.timeout_min || 5) * 60;
                this.redis.n_conn = this.redis.n_conn || 16;
        }
}

const config = {
        inst() {
                if (!this._inst) {
                        // eslint-disable-next-line no-undef
                        const conf_path = path.join(
                                process.cwd(),
                                "config.json"
                        );
                        let conf = fs.readFileSync(conf_path);
                        conf = JSON.parse(conf);
                        this._inst = new config_t(conf);
                }

                return this._inst;
        },
};

module.exports = config;

if (require.main === module) {
        console.dir(config.inst());
}
