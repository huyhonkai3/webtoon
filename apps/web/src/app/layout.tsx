import type {Metadata} from 'next'
import type {ReactNode} from 'react'

import './globals.css'

export const metadata: Metadata = {
    title: 'Webtoon - Thư viện truyện',
    description: 'Ứng dụng đọc webtoon, manhwa cá nhân.'
}

export default function RootLayout({
    children
}: {
    children: ReactNode
}) {
    return (
        <html lang='vi'>
            <body>{children}</body>
        </html>
    )
}