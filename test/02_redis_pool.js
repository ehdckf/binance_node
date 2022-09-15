/* eslint-disable no-unused-vars */
"use strict";

const http = require("http");
const Koa = require("koa");
const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");
const crypto = require("crypto");
const BigNumber = require("bignumber.js");
// https://github.com/websockets/ws/issues/1334
// https://github.com/websockets/ws/issues/1338
const { WebSocketServer } = require("ws");
// const { getPrice, getPriceIQR } = require("./api/price");

const RedisPool = require("../src/redis");

const app = new Koa();
const router = new Router();

router.get("/ping", (ctx, next) => {
  ctx.body = "OK";
  next();
});

const wss = new WebSocketServer({ noServer: true });

//------------------------------------------------------------------------------
const { backend_t } = require("./backend");
const HenesisAPI = require("./api/henesis");

const config = require("./config");
// singleton
class backends_t {
  constructor() {
    const { servers } = config.inst().backend;

    this.bes = [
      new backend_t("admincli", servers.admincli.tr_info),
      //FIXME: IF 803 TR is a discarded TR, Rpp is no longer needed.
      new backend_t("rpp", servers.rpp.tr_info),
    ];
  }

  async connect() {
    const { servers } = config.inst().backend;

    const p = this.bes.map((be) =>
      be.connect(servers[be.name], servers[be.name].xor)
    );
    await Promise.all(p);
  }

  async request(req, ws_cb) {
    const be = this.bes.find((be) => be.acceptable_tr(req.tr_code));
    if (!be) {
      throw new Error(`no handler for ${req.tr_code}`);
    }

    return await be.request(req, ws_cb);
  }

  //FIXME: If admin_node dose not have RealTimeTR or AllUserTR, we dont need this method;
  unrequest_all(ws_cb) {
    for (const be of this.bes) {
      be.unrequest_all(ws_cb);
    }
  }
}

backends_t.inst = () => {
  if (!backends_t._inst) {
    backends_t._inst = new backends_t();
  }

  return backends_t._inst;
};

//FIXME: If admin_node dose not have RealTimeTR or AllUserTR,  It is no longer necessary to maintain a set of socket clients.
//FIXME: This class sholud be deleted and websocket class should be update.

class ws_man_t {
  constructor() {
    this.socks = new Set();

    let interval = 30000;
    try {
      if (config.inst().ping_interval) {
        interval = Number(config.inst().ping_interval);
      }
    } catch (e) {
      // do nothing.
    }
    if (interval < 10000) {
      interval = 10000;
    }

    // TODO: check only idle sockets
    // heartbeat checking
    this.ping = setInterval(() => {
      // websocket clients
      for (const ws of this.socks) {
        if (!ws.isAlive) {
          //console.log('close not responding client');
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      }
    }, interval);

    //wss.on('close', () => {
    //	clearInterval(ping);
    //});
  }

  add(ws) {
    console.log("ws added to ws_man_t");
    this.socks.add(ws);
  }

  delete(ws) {
    console.log("ws deleted from ws_man_t");
    this.socks.delete(ws);
  }
}

ws_man_t.inst = () => {
  if (!ws_man_t._inst) {
    ws_man_t._inst = new ws_man_t();
  }

  return ws_man_t._inst;
};

class websocket_t {
  constructor(ws) {
    console.log("ws connected");

    this.isAlive = true;
    this.ws = ws;

    this.notify = (notify, sym_code) => {
      try {
        ws.send(JSON.stringify(notify));
      } catch (e) {
        // do nothing.
      }
    };

    ws.on("pong", () => {
      //ws.isAlive = true;
      this.isAlive = true;
    });

    ws.on("message", async (data, isBinary) => {
      try {
        //				if (Buffer.isBuffer(data)) {
        //					console.log('buffer', isBinary);
        //					data = data.toString();
        //					console.log('data', data);
        //				}
        data = data.toString();
        const req = JSON.parse(data);
        console.log("req", req);
        const trCode = req.tr_code;
        const api = req.api;

        //FIXME: 7010??
        if (trCode == "2290" || (trCode == "7010" && req.proc_sect != 4)) {
          req.pwd = crypto.createHash("sha256").update(req.pwd).digest("hex");
        }

        if (trCode == "2039" && api == "henesis") {
          // 출금신청 요청
          if (req.proc_stat == "5") {
            const withdraw_info = [];
            let henesis_func = "";
            let amount_proc;

            switch (req.coin_type) {
              case "BTC": {
                henesis_func = "withdraw_btc";
                const amount_bit = new BigNumber(req.amount);
                const amount_satoshi = amount_bit.times(100000000);
                amount_proc = "0x" + amount_satoshi.toString(16);
                break;
              }
              case "ETH": {
                henesis_func = "withdraw_eth";
                const amount_eth = new BigNumber(req.amount);
                const wei = new BigNumber("1000000000000000000");
                const amount_wei = amount_eth.times(wei);
                amount_proc = "0x" + amount_wei.toString(16);
                break;
              }
              default: {
                henesis_func = "withdraw_token";
                const amount_token = new BigNumber(req.amount);
                const wei = new BigNumber("1000000000000000000");
                const amount_wei = amount_token.times(wei);
                amount_proc = "0x" + amount_wei.toString(16);
                withdraw_info.push(req.coin_type);
              }
            }

            withdraw_info.push(req.to);
            withdraw_info.push(amount_proc);

            try {
              const henesisRes = await HenesisAPI(henesis_func, withdraw_info);

              req.additional_data =
                req.coin_type == "BTC"
                  ? henesisRes.transaction.transactionHash
                  : henesisRes.id + "/";
            } catch (e) {
              //TODO: return Error
            }
          }
        } else if (trCode == "3402" && api == "henesis") {
          const id_list = [...new Set(req.id_list)];
          const cw_seq = req.cw_seq;
          try {
            await HenesisAPI("gether_eth", id_list);
            req.data = cw_seq;
          } catch (e) {
            //TODO: return Error
          }
        } else if (trCode == "3403" && api == "henesis") {
          //출금 신청 확인
          const henesis_func =
            req.coin_type == "BTC" ? "confirm_btc" : "confirm_eth";

          try {
            const henesisRes = await HenesisAPI(henesis_func, req.transaction);

            const status = henesisRes.results[0].status;
            const t_hash = henesisRes.results[0].transaction.transactionHash;
            const t_id = henesisRes.results[0].transaction.transactionId;

            switch (status) {
              case "REQUESTED":
              case "PENDING":
              case "MINED":
                req.proc_stat = "6";
                break;
              case "CONFIRMED":
                req.proc_stat = "7";
                break;
              case "FAILED":
              case "REJECTED":
                req.proc_stat = "9";
                break;
            }

            req.additional_data =
              req.coin_type == "BTC" ? t_hash : `${t_id}/${t_hash}`;
          } catch (e) {
            //TODO: return Error
          }
        }

        const resp = await backends_t.inst().request(req, this.notify);
        if (resp) {
          // ui request id
          resp.handle = req.handle;

          console.log("resp", resp);
          ws.send(JSON.stringify(resp));
        }
      } catch (e) {
        // do nothing.
      }
    });

    ws.on("close", () => {
      // backends_t.inst().unrequest_all(this.notify);
      ws_man_t.inst().delete(this);
    });

    ws.on("error", () => {
      ws.terminate();
    });

    ws_man_t.inst().add(this);
  }

  terminate() {
    this.ws.terminate();
  }

  ping() {
    this.ws.ping();
  }
}

wss.on("connection", (ws, request, resolve) => {
  //	// TODO
  //	// client wrapper
  //	ws.isAlive = true;
  //	ws.on('pong', () => {
  //		ws.isAlive = true;
  //	});
  //
  //	ws.on('message', (data, isBinary) => {
  //	});
  //	ws.on('close', () => {
  //	});
  //	ws.on('error', () => {
  //	});
  //
  //	resolve(ws);

  resolve(new websocket_t(ws));
});

function verify_upgrade(ctx) {
  const header = ctx.headers;

  // check websocket upgrade header
  if (!header.connection || header.connection.toLowerCase() !== "upgrade") {
    ctx.throw(400, "Bad Request");
  }

  if (!header.upgrade || header.upgrade.toLowerCase() !== "websocket") {
    ctx.throw(400, "Bad Request");
  }
}

router.get("/", async (ctx, next) => {
  verify_upgrade(ctx);

  console.log("verified");

  const ws = await new Promise((resolve, reject) => {
    wss.handleUpgrade(
      ctx.req,
      ctx.request.socket,
      // eslint-disable-next-line no-undef
      ctx.request.rawBody || Buffer.alloc(0),

      (ws) => {
        wss.emit("connection", ws, ctx.req, resolve);
      }
      //			(...args) => {
      //				//console.dir(args);
      //				reject();
      //			}
    );

    ctx.respond = false;
  });

  //ws.send('from server');

  //console.log('error!!');

  await next();
});

router.get("/test", async (ctx, next) => {
  console.log("test");
  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  let redis = await RedisPool.get();
  try {
    console.log(RedisPool.free.length);
    await redis.set("kill", "bill", { EX: 6 });
    await sleep(5000);
    let data = await redis.get("kill");
    console.log(data);
    await sleep(2000);
    data = await redis.get("kill");
  } catch (e) {
    console.log(e);
  } finally {
    if (redis) RedisPool.put(redis);
  }
});

router.get("/test2", async (ctx, next) => {
  console.log("test2");
  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  let redis = await RedisPool.get();
  try {
    console.log(RedisPool.free.length);
    await redis.set("kill", "bill", { EX: 6 });
    await sleep(5000);
    let data = await redis.get("kill");
    console.log(data);
    await sleep(2000);
    data = await redis.get("kill");
  } catch (e) {
    console.log(e);
  } finally {
    if (redis) RedisPool.put(redis);
  }
});

router.get("/test3", async (ctx, next) => {
  console.log("test3");
  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  let redis = await RedisPool.get();
  try {
    console.log(RedisPool.free.length);
    await redis.set("kill", "bill", { EX: 6 });
    await sleep(5000);
    let data = await redis.get("kill");
    console.log(data);
    await sleep(2000);
    data = await redis.get("kill");
  } catch (e) {
    console.log(e);
  } finally {
    if (redis) RedisPool.put(redis);
  }
});

app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

const server = http.createServer(app.callback());

if (require.main === module) {
  (async () => {
    await backends_t.inst().connect();

    const { frontend } = config.inst();

    server.listen(frontend.port, frontend.host);
  })();
}
