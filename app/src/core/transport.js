/**
 * The transport contract.
 *
 * Everything above this line — the sync component, the roles, the clock —
 * depends on these four methods and on nothing else. It does not know whether
 * messages travel over MQTT to twenty-five headsets or stay inside one browser
 * tab.
 *
 * That is the point. `LocalTransport` implements this contract in-page, so the
 * whole application runs on a laptop with no Raspberry Pi, no broker and no
 * router. Content and templates get built before the hardware arrives, and the
 * sync layer stays testable.
 *
 * `MqttTransport` implements the same four methods over mqtt.js for the
 * classroom. Swapping one for the other is one line in the role module.
 */

export class Transport {
  /** Open the connection. Resolves once messages can flow. */
  async connect() {
    throw new Error('Transport.connect not implemented');
  }

  /**
   * @param {string} topic
   * @param {object} payload   plain JSON — never a class instance
   * @param {{retain?: boolean, qos?: number}} [options]
   */
  publish(topic, payload, options) {
    throw new Error('Transport.publish not implemented');
  }

  /**
   * @param {string} topic     may end in `/+` for a single-level wildcard
   * @param {(payload: object, topic: string) => void} handler
   */
  subscribe(topic, handler) {
    throw new Error('Transport.subscribe not implemented');
  }

  /** Close cleanly. A headset closing this way does not fire its will. */
  disconnect() {
    throw new Error('Transport.disconnect not implemented');
  }
}

/** Topics, in one place, so a typo is a missing import rather than silence. */
export const TOPIC = {
  state: 'class/state',
  command: 'class/command',
  status: (id) => `headset/${id}/status`,
  statusWildcard: 'headset/+/status',
  will: (id) => `headset/${id}/lwt`,
};
