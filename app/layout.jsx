
import './jodit.css'
import "../public/00_common/css/basic.css";
import "../public/font/Pretendard/fonts.css";
import 'remixicon/fonts/remixicon.css';

export const metadata = {
  title: '에디터',
  description: 'HTML 에디터',
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