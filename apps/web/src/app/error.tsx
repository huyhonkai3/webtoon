'use client'

export default function ErrorPage({
    reset
}: {
    reset: () => void
}) {
    return (
        <main>
            <h1>Chưa tải được thư viện</h1>

            <p>Vui lòng thử lại sau.</p>

            <button onClick={reset}>
                Thử lại
            </button>
        </main>
    )
}