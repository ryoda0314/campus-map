export const metadata = {
  title: "キャンパスマップ",
  description: "大学キャンパスのナビゲーションマップ",
  manifest: "/manifest.json",
  themeColor: "#1a1a1f",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "キャンパスマップ",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body style={{ margin: 0, background: "#1a1a1f", touchAction: "pan-x pan-y", overscrollBehavior: "none" }}>
        <style dangerouslySetInnerHTML={{ __html: `html,body{touch-action:pan-x pan-y;overscroll-behavior:none;-webkit-text-size-adjust:100%}` }} />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}document.addEventListener('gesturestart',function(e){e.preventDefault()},{passive:false});document.addEventListener('gesturechange',function(e){e.preventDefault()},{passive:false});document.addEventListener('gestureend',function(e){e.preventDefault()},{passive:false});`,
          }}
        />
      </body>
    </html>
  );
}