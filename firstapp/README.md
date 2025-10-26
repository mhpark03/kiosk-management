# Kiosk Management System - Admin Dashboard

A modern React-based admin dashboard for managing kiosks, videos, and AI-generated content using Runway ML.

## Features

### 🔐 User Authentication
- JWT-based authentication with Spring Boot backend
- Email/password login
- Password reset functionality
- Admin and user role management
- Session persistence

### 🎬 Video Management
- Upload videos to AWS S3
- View and manage video library
- Video metadata editing (title, description)
- Thumbnail generation and management
- Video playback with presigned URLs
- Support for multiple video formats (MP4, MPEG, MOV, AVI, WMV, WEBM)

### 🤖 AI Content Generation (Runway ML)

#### Image Generation
- **gen4_image** model for AI image creation
- Upload 1-5 reference images
- Dual image source selection:
  - 📁 Local PC upload
  - 🖼️ Server-stored images (S3)
- Auto aspect ratio adjustment with padding
- Customizable settings:
  - Style: 사실적, 애니메이션 (default), 예술적, 사진, 일러스트
  - Aspect ratio: 1024:1024, 1920:1080 (default), 1080:1920, 1440:1080, 1080:1440
- Save generated images to S3 and database
- Real-time generation status polling

#### Video Generation
- Multiple AI models:
  - **veo3.1_fast** (default) - Fast generation (4/6/8 sec)
  - **veo3.1** - High quality (4/6/8 sec)
  - **veo3** - Premium quality (8 sec)
  - **gen4_turbo** - Turbo generation (2-10 sec)
  - **gen3a_turbo** - Legacy turbo (5/10 sec)
- Image-to-video generation from 2 reference images
- Dual image source selection (PC/Server)
- Auto aspect ratio adjustment
- Configurable duration and resolution
- Save generated videos to S3 and database

### 📊 Admin Features
- User management dashboard
- User activation/deactivation
- User role assignment
- Video assignment to users
- System analytics and monitoring

### 🎨 Modern UI
- Gradient styling with smooth animations
- Responsive design for all screen sizes
- Full image preview (object-fit: contain)
- Source badges (PC/서버) on previews
- Loading states and progress indicators
- Error handling with user-friendly messages

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **CSS3** - Custom styling with gradients and animations

### Backend Integration
- Spring Boot REST API (Port 8080)
- JWT authentication
- AWS S3 for media storage
- MySQL database
- Runway ML API for AI generation

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Backend API running on `http://localhost:8080`
- Runway ML API key (configured in backend)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mhpark03/kiosk-management.git
cd firstapp
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
# Create .env file (optional)
VITE_API_URL=http://localhost:8080/api
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `https://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server (HTTPS on port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
firstapp/
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Navbar.jsx
│   │   ├── VideoUpload.jsx
│   │   ├── VideoList.jsx
│   │   ├── VideoPlayer.jsx
│   │   ├── ImageGenerator.jsx
│   │   ├── VideoGenerator.jsx
│   │   ├── S3ImageSelector.jsx
│   │   ├── UserManagement.jsx
│   │   ├── AdminVideoAssignment.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── *.css (component styles)
│   ├── services/
│   │   ├── api.js
│   │   ├── authService.js
│   │   ├── videoService.js
│   │   ├── imageService.js
│   │   └── runwayService.js
│   ├── App.jsx
│   └── main.jsx
├── .env.example
└── package.json
```

## Key Features Explained

### Dual Image Source Selection

Users can choose between two image sources when generating AI content:

1. **PC Upload**: Traditional file picker for local images
2. **Server Selection**: Browse and select from previously uploaded/generated images stored in S3

### Auto Aspect Ratio Adjustment

Images outside the Runway ML API requirement (0.5-2.0 aspect ratio) are automatically adjusted:

- **Frontend**: Canvas-based padding with black background
- **Backend**: Java BufferedImage processing
- **Too tall images (ratio < 0.5)**: Add left/right padding → 0.7 ratio
- **Too wide images (ratio > 2.0)**: Add top/bottom padding → 1.5 ratio
- **Preserves entire image**: No cropping, all content visible

### Image Preview Optimization

- Uses `object-fit: contain` instead of `cover`
- Shows entire image without cropping
- Black background for letterbox/pillarbox effect
- Prevents loss of important image details

## API Integration

The frontend communicates with the Spring Boot backend API:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/forgot-password` - Password reset request

### Videos
- `GET /api/videos` - List all videos (with mediaType filter)
- `POST /api/videos/upload` - Upload video
- `GET /api/videos/{id}` - Get video details
- `PATCH /api/videos/{id}` - Update video metadata
- `DELETE /api/videos/{id}` - Delete video
- `GET /api/videos/{id}/presigned-url` - Generate playback URL

### Runway ML
- `POST /api/runway/generate-image` - Generate AI image
- `POST /api/runway/generate-video` - Generate AI video
- `GET /api/runway/task-status/{taskId}` - Poll generation status
- `POST /api/videos/save-runway-image` - Save generated image to S3/DB
- `POST /api/videos/save-runway-video` - Save generated video to S3/DB

### Admin
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/{id}/role` - Update user role
- `PUT /api/admin/users/{id}/active` - Activate/deactivate user

## Environment Variables

Create a `.env` file for custom configuration:

```env
VITE_API_URL=http://localhost:8080/api
```

## Usage

### For Regular Users

1. **Login**: Access your account with email and password
2. **Upload Videos**: Upload videos to your library
3. **Generate AI Images**: Use Runway ML to create images from references
4. **Generate AI Videos**: Create videos from image sequences
5. **Manage Library**: View, edit, and delete your content

### For Administrators

1. **User Management**: View and manage all users
2. **Video Assignment**: Assign videos to specific users
3. **Content Moderation**: Review and manage all uploaded content
4. **System Monitoring**: Track usage and system health

## AI Generation Tips

### Image Generation
- Use 1-5 reference images for best results
- Mix PC uploads and server images for variety
- Experiment with different styles (애니메이션 works great!)
- Use descriptive prompts in Korean or English
- Default aspect ratio (1920:1080) works for most cases

### Video Generation
- Use high-quality reference images
- Keep prompts specific and descriptive
- Start with veo3.1_fast for quick iterations
- Use longer durations (8s) for smoother transitions
- Select appropriate resolution for your output needs

## Troubleshooting

### Backend Connection Issues
- Ensure backend is running on port 8080
- Check CORS configuration in backend
- Verify JWT token is valid

### Image Upload Failures
- Check file size (max 10MB)
- Verify file format (images only)
- Images outside 0.5-2.0 ratio are auto-adjusted

### AI Generation Issues
- Verify Runway ML API key in backend
- Check account credits at https://runwayml.com
- Monitor task status for detailed error messages
- Some generations may take 1-3 minutes

## Security Notes

- JWT tokens stored in localStorage
- Tokens expire after configured duration
- Admin routes protected by role-based access
- S3 presigned URLs expire after 60 minutes
- Never commit `.env` files with real credentials

## Performance Optimization

- Lazy loading for video components
- Thumbnail caching
- Presigned URL caching (60 min)
- Optimized image previews with object-fit: contain
- Task polling with exponential backoff

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## License

MIT

## Author

mhpark03

## Related Repositories

- Backend API: [kiosk-backend](../backend)
- Kiosk App: [kiosk-downloader](../kiosk-downloader)
# Updated 2025년 10월 26일 일 오전 11:58:33
