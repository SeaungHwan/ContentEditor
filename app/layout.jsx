
import './jodit.css'
import "../public/00_common/css/basic.css";
import "../public/font/Pretendard/fonts.css";
import 'remixicon/fonts/remixicon.css';

export const metadata = {
  title: {
    default: '에디터',
    template: '%s | 에디터',
  },
  description: 'HTML 컨텐츠 에디터',
  manifest: '/manifest.webmanifest',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}