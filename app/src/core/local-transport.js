/**
 * A transport that never leaves the page.
 *
 * Both roles run in one browser tab and talk to each other through this. It is
 * how a lesson is authored, previewed and debugged without a broker.
 *
 * It deliberately reproduces the two MQTT behaviours the product relies on, so
 * that code written against it does not break when the real broker arrives:
 *
 *   - retained messages: a late subscriber immediately receives the last
 *     message on the topic, which is how a rebooted headset rejoins at the
 *     right step
 *   - wildcard subscriptions: `headset/+/status` matches every headset
 */

import { Transport } from './transport.js';

export class LocalTransport extends Transport {
  #handlers = new Map(); // topic pattern → handler[]
  #retained = new Map(); // exact topic → payload

  async connect() {
    return this;
  }

  publish(topic, payload, { retain = false } = {}) {
    if (retain) this.#retained.set(topic, payload);

    for (const [pattern, handlers] of this.#handlers) {
      if (!matches(pattern, topic)) continue;
      for (const handler of handlers) handler(payload, topic);
    }
  }

  subscribe(topic, handler) {
    const handlers = this.#handlers.get(topic) ?? [];
    handlers.push(handler);
    this.#handlers.set(topic, handlers);

    // Deliver anything already retained, exactly as a broker would on connect.
    for (const [retainedTopic, payload] of this.#retained) {
      if (matches(topic, retainedTopic)) handler(payload, retainedTopic);
    }
  }

  disconnect() {
    this.#handlers.clear();
  }
}

/** MQTT wildcards: `+` matches one level, `#` matches the rest. */
function matches(pattern, topic) {
  const p = pattern.split('/');
  const t = topic.split('/');

  for (let i = 0; i < p.length; i += 1) {
    if (p[i] === '#') return true;
    if (p[i] === '+') continue;
    if (p[i] !== t[i]) return false;
  }

  return p.length === t.length;
}
