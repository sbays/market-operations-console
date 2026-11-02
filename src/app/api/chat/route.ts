import { createChatHandler } from "./handler";

export const POST = createChatHandler({
  firstTokenDelayMs: 500,
  tokenDelayMs: 30,
});
