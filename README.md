# Sangam - Community Platform

A full-stack web application for community interaction, built with Flask (backend) and vanilla JavaScript (frontend).

## Features

- **Roll Number Authentication**: Secure login/signup using roll numbers validated against a CSV file
- **Community Feed**: Share and view posts from community members
- **Job Board**: Post and browse job opportunities
- **Real-time Chat**: Communicate with other users
- **Notifications**: Stay updated with platform activities
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
sangam/
├── frontend/
│   ├── index.html          ← Public home page
│   ├── pages/
│   │   ├── auth.html       ← Login / Signup
│   │   └── dashboard.html  ← Main app (after login)
│   ├── css/
│   │   ├── variables.css   ← Design tokens
│   │   ├── base.css        ← Reset, layout, toast
│   │   ├── components.css  ← Navbar, sidebar, buttons, cards
│   │   ├── home.css        ← Public home page styles
│   │   ├── auth.css        ← Auth screen styles
│   │   └── dashboard.css   ← Dashboard styles
│   └── js/
│       ├── api.js          ← All API calls
│       ├── sidebar.js      ← Hamburger menu
│       ├── auth.js         ← Login / signup logic
│       └── dashboard.js    ← Main app: feed, jobs, chat, profile
│
└── backend/
    ├── app.py              ← Flask entry point — run this
    ├── requirements.txt    ← pip dependencies
    ├── config/
    │   ├── settings.py     ← All configuration
    │   └── database.py     ← DB connection
    ├── models/
    │   ├── user.py         ← User schema
    │   ├── post.py         ← Post schema
    │   ├── job.py          ← Job schema
    │   ├── chat.py         ← Chat message schema
    │   └── notification.py ← Notification schema
    ├── routes/
    │   ├── auth.py         ← /api/auth/* — ROLL NUMBER VALIDATION HERE
    │   ├── users.py        ← /api/users/*
    │   ├── posts.py        ← /api/posts/*
    │   ├── jobs.py         ← /api/jobs/*
    │   ├── chat.py         ← /api/chat/*
    │   └── notifs.py       ← /api/notifications/*
    ├── middleware/
    │   └── auth_middleware.py ← JWT token check
    └── data/
        └── students.csv    ← Student roll numbers and info
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd sangam/backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Update the student data:
   - Edit `data/students.csv` with your actual student roll numbers and information
   - Format: `roll_number,name,email`

4. Run the Flask application:
   ```bash
   python app.py
   ```

   The backend will be available at `http://localhost:5000`

### Frontend Setup

1. The frontend is static HTML/CSS/JS, so you can serve it using any web server or open the files directly in a browser.

2. For development, you can use Python's built-in server:
   ```bash
   cd sangam/frontend
   python -m http.server 8000
   ```

   The frontend will be available at `http://localhost:8000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with roll number
- `POST /api/auth/signup` - Signup with roll number and password
- `GET /api/auth/verify` - Verify JWT token

### Users
- `GET /api/users/me` - Get current user info
- `GET /api/users` - Get all users
- `GET /api/users/<id>` - Get specific user

### Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post
- `GET /api/posts/<id>` - Get specific post
- `PUT /api/posts/<id>` - Update post
- `DELETE /api/posts/<id>` - Delete post

### Jobs
- `GET /api/jobs` - Get all jobs
- `POST /api/jobs` - Create new job posting
- `GET /api/jobs/<id>` - Get specific job
- `PUT /api/jobs/<id>` - Update job
- `DELETE /api/jobs/<id>` - Delete job

### Chat
- `GET /api/chat/messages?recipient_id=<id>` - Get messages with user
- `POST /api/chat/messages` - Send message
- `GET /api/chat/conversations` - Get conversation list

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/<id>/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read

## Roll Number Validation

The authentication system validates roll numbers against the `students.csv` file. To add new students:

1. Open `backend/data/students.csv`
2. Add rows in the format: `roll_number,name,email`
3. Restart the backend server

## Technologies Used

- **Backend**: Flask, SQLAlchemy, JWT, bcrypt
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT tokens
- **Styling**: Custom CSS with CSS Variables

## Development

- The frontend uses ES6 modules for JavaScript
- API calls are centralized in `api.js`
- Authentication tokens are stored in localStorage
- Responsive design works on mobile and desktop

## Security Notes

- JWT tokens expire after 24 hours
- Passwords are hashed using bcrypt
- CORS is enabled for cross-origin requests
- Input validation is implemented on both frontend and backend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.