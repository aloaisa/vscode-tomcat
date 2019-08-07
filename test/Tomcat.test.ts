'use strict';

import * as assert from "assert";
import { DialogMessage } from '../src/DialogMessage';
import { WildflyController } from "../src/Wildfly/WildflyController";
import { WildflyModel } from "../src/Wildfly/WildflyModel";
import { WildflyServer } from "../src/Wildfly/WildflyServer";
import { Utility } from "../src/Utility";

suite('Error input', () => {
  const serverInfo: WildflyServer = undefined;
  const wildflyModel: WildflyController = new WildflyController(new WildflyModel(''), undefined);
  test('stopServer', async () => {
    try {
      await wildflyModel.stopOrRestartServer(serverInfo);
      assert.fail('Resolve', 'Reject');
    } catch (error) {
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
  test('runOnServer', async () => {
    try {
      await wildflyModel.runOrDebugOnServer(undefined);
    } catch (error) {
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
});
