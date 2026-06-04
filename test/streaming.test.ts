import assert from "node:assert/strict";
import { collectStreamedMessage } from "../src/agent/streaming.js";

async function* chunks(): AsyncIterable<unknown> {
  yield {
    choices: [{
      delta: {
        reasoning_content: "plan",
        content: "Hello ",
        tool_calls: [{
          index: 0,
          id: "call_",
          type: "function",
          function: { name: "wolfram_", arguments: "{\"expr\":" }
        }]
      }
    }]
  };
  yield {
    choices: [{
      delta: {
        content: "world",
        tool_calls: [{
          index: 0,
          id: "1",
          function: { name: "simplify", arguments: "\"x\"}" }
        }]
      },
      finish_reason: "tool_calls"
    }]
  };
}

const thinking: string[] = [];
const output: string[] = [];
const streamed = await collectStreamedMessage(chunks(), {
  onThinkingDelta(text) {
    thinking.push(text);
  },
  onOutputDelta(text) {
    output.push(text);
  }
});

assert.equal(streamed.finishReason, "tool_calls");
assert.equal(streamed.message.content, "Hello world");
assert.deepEqual(thinking, ["plan"]);
assert.deepEqual(output, ["Hello ", "world"]);
assert.equal(streamed.message.tool_calls?.[0]?.id, "call_1");
assert.equal(streamed.message.tool_calls?.[0]?.function.name, "wolfram_simplify");
assert.equal(streamed.message.tool_calls?.[0]?.function.arguments, "{\"expr\":\"x\"}");

console.log("streaming tests passed");

