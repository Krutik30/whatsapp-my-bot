# WhatsApp Bot API with Baileys

A robust WhatsApp bot API built using Baileys library, featuring session management, interactive conversations, and real-time messaging capabilities.

## Features

- 🔐 Secure session management with PostgreSQL
- 💬 Interactive conversation flows
- 🔄 Automatic reconnection handling
- 📱 Support for multiple WhatsApp sessions
- 🎯 Button-based interactions
- 📊 Real-time message status updates
- 👥 Group and contact management
- 🔍 WhatsApp number validation

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- WhatsApp account

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp-bailyes-api.git
cd whatsapp-bailyes-api
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/whatsapp_bot"
AUTH_TOKEN="your-secret-token"
RECONNECT_INTERVAL=5000
MAX_RECONNECT_RETRIES=5
```

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

## Usage

### Starting the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

### API Endpoints

#### Session Management

1. Create a new session:
```bash
curl -X POST http://localhost:3000/sessions/add \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session"}'
```

2. List all sessions:
```bash
curl http://localhost:3000/sessions/list \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

3. Get session status:
```bash
curl http://localhost:3000/sessions/status/SESSION_ID \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

4. Delete a session:
```bash
curl -X DELETE http://localhost:3000/sessions/delete/SESSION_ID \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

#### Messaging

1. Send text message:
```bash
curl -X POST http://localhost:3000/messages/text \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID",
    "jid": "RECIPIENT_NUMBER@s.whatsapp.net",
    "text": "Hello from WhatsApp API!"
  }'
```

2. Send bulk messages:
```bash
curl -X POST http://localhost:3000/messages/bulk \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID",
    "messages": [
      {
        "jid": "NUMBER1@s.whatsapp.net",
        "text": "Message 1"
      },
      {
        "jid": "NUMBER2@s.whatsapp.net",
        "text": "Message 2"
      }
    ]
  }'
```

### Conversation Flow

The bot implements an interactive conversation flow for vaccine appointments:

1. User starts with "hi" or "hello"
2. Bot responds with appointment booking options
3. User can select time slots
4. Confirmation and follow-up messages

## Project Structure

```
src/
├── bot/
│   ├── flows/         # Conversation flow handlers
│   ├── handlers/      # Message handlers
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
├── controller/        # API controllers
├── middleware/        # Express middleware
├── prisma/           # Database schema
├── router/           # API routes
├── store/            # Session storage
├── wa.ts             # WhatsApp connection
└── index.ts          # Application entry
```

## Error Handling

The bot includes comprehensive error handling for:
- Connection issues
- Authentication failures
- Message delivery problems
- Database errors
- Invalid inputs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Acknowledgments

- [Baileys](https://github.com/whiskeysockets/baileys) - WhatsApp Web API
- [Prisma](https://www.prisma.io/) - Database ORM
- [Express](https://expressjs.com/) - Web framework

## Support

For support, please open an issue in the GitHub repository or contact the maintainers. 