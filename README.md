# tweetapus

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

## Development

Start the server: `bun run src/index.js`

## TweetaAI (experimental)

This project includes a small AI chat feature at `/account/tweetaai/` backed by the OpenAI API.

To enable it locally set the environment variable `OPENAI_API_KEY` to a valid OpenAI key. The server will expose a POST endpoint at `/api/tweetaai/chat` that requires a valid JWT (the same token used by the app).

The front-end page is `public/account/tweetaai/index.html` and will try to use the JWT stored in `localStorage.token` by default.

Notes:

- The AI system prompt limits replies to ~280 characters and uses a friendly tone.
- Conversations are stored in `tweetaai_chats` if the table exists; the code will not create the table automatically.

This project was created using create-tiago-app.
