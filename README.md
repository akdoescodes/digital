# AR Bistro - Augmented Reality Restaurant Menu

A modern web application that showcases a restaurant menu with augmented reality capabilities, built with React, TypeScript, and Three.js.

## ✨ Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **AR Support Detection**: Automatically detects WebXR AR capabilities
- **Interactive Menu Cards**: Beautifully designed menu items with hover effects
- **Error Boundaries**: Graceful error handling and recovery
- **Accessibility**: Full keyboard navigation and screen reader support
- **Type Safety**: Built with TypeScript for better development experience
- **Modern Styling**: Tailwind CSS with custom animations

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript
- **3D/AR**: Three.js, @react-three/fiber, @react-three/drei
- **Styling**: Tailwind CSS with custom extensions
- **Build Tool**: Vite
- **Linting**: ESLint with TypeScript support
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ar-bistro
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📱 AR Support

The application automatically detects WebXR AR support. For the best AR experience:

- Use a device with AR capabilities (Android with ARCore, iOS with ARKit)
- Use a WebXR-compatible browser (Chrome, Edge on Android; Safari on iOS)
- Ensure good lighting conditions for surface detection

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── ARMenu.tsx      # AR experience component
│   ├── MenuCard.tsx    # Menu item card
│   ├── ErrorBoundary.tsx # Error handling
│   └── LoadingSpinner.tsx # Loading indicator
├── constants/          # Application constants
├── data/              # Static data (menu items)
├── types/             # TypeScript type definitions
├── utils/             # Utility functions (AR manager)
└── main.tsx           # Application entry point
```

## 🔧 Configuration

### Tailwind CSS

Custom animations and colors are defined in `tailwind.config.js`:
- Custom float animation for AR elements
- Extended amber color palette
- Responsive grid configurations

### TypeScript

Type definitions for Three.js and React Three Fiber are included for better development experience.

## 🎨 Design Features

- **Custom Animations**: Floating animations for 3D elements
- **Gradient Backgrounds**: Modern gradient designs
- **Interactive Feedback**: Hover and focus states
- **Consistent Typography**: Carefully selected font weights and sizes

## 🔍 Browser Support

- **Modern Browsers**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **AR Features**: Requires WebXR support (Chrome/Edge on Android, Safari on iOS)

## 📈 Performance

- **Optimized Bundle**: Code splitting and tree shaking enabled
- **Lazy Loading**: Components loaded on demand
- **Compressed Assets**: Gzip compression in production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Three.js community for excellent WebGL/WebXR tools
- React Three Fiber for React integration
- Tailwind CSS for utility-first styling
- Lucide for beautiful icons
