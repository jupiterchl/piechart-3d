export const events = ['mousemove', 'click'];

class Handler {
  handlers = {};

  once(type, fn) {
    fn._once = true;
    this.on(type, fn);
  }

  on(type, fn) {
    this.handlers[type] = this.handlers[type] || new Set();
    this.handlers[type].add(fn);
  }

  off(type, fn) {
    const handlers = this.handlers[type];
    if (handlers && handlers.has(fn)) {
      handlers.delete(fn);
    }
  }

  all(fn) {
    events.forEach((type) => {
      this.on(type, fn);
    });
  }

  none(fn) {
    events.forEach((type) => {
      this.off(type, fn);
    });
  }

  emit(type, ...args) {
    const handlers = this.handlers[type];
    if (handlers) {
      handlers.forEach((fn) => {
        fn(...args);

        if (fn._once) {
          this.off(type, fn);
        }
      });
    }
  }

  clear() {
    this.handlers = {};
  }
}

export default Handler;
