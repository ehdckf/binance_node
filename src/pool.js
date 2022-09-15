class Pool {
  free = [];
  queue = [];
  initialized = false;

  constructor(n, _create, _init) {
    const create = _create;
    for (let i = 0; i < n; ++i) {
      this.free.push(create());
    }
    this._init = _init;
  }

  async init() {
    if (this.initialized) return;
    await Promise.all(this.free.map((e) => this._init(e)));
    this.initialized = true;
  }

  async get() {
    await this.init();

    if (this.free.length > 0) {
      return this.free.shift();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  put(resource) {
    if (this.queue.length > 0) {
      return this.queue.shift()(resource);
    }
    this.free.push(resource);
  }
}

module.exports = Pool;
