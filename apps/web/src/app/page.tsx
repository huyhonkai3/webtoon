import Link from 'next/link'
import {getSeries} from '../lib/api'

export const dynamic = 'force-dynamic'

interface HomeProps {
    searchParams: Promise<{
        page?: string | string[]
    }>
}

export default async function Home({
    searchParams
}: HomeProps) {
    const {page: rawPage} = await searchParams

    const parsed = typeof rawPage === 'string' ? Number(rawPage) : 1

    const page = Number.isInteger(parsed) && parsed >= 1 && parsed <= 100000 ? parsed : 1

    const {data, pagination} = await getSeries(page)

    return (
        <main>
            <p className='eyebrow'>
                WEBTOON/ BƯỚC 01
            </p>

            <h1>Thư viện truyện</h1>

            <p className='intro'>Một khởi đầu cho những câu chuyện dài.</p>

            <section aria-label='Danh sách truyện' className='grid'>
                {data.map((series, index) => {
                    const number = (page - 1) * pagination.pageSize + index + 1
                    return (
                        <article key={series.id}>
                            <div className='cover' aria-hidden='true'>
                                <span>
                                    {String(number).padStart(2, '0')}
                                </span>
                            </div>

                            <h2>{series.title}</h2>

                            <p>{series.description}</p>
                        </article>
                    )
                })}
            </section>

            {data.length === 0 && (
                <p>Chưa có truyện ở trang này.</p>
            )}

            <nav aria-label='Phân trang'>
                {
                    page > 1 && (
                        <Link href={`/?page=${page - 1}`}> ← Trang trước</Link>
                    )
                }
                <span>
                    Trang {page} · {pagination.total} truyện
                </span>

                {page < pagination.totalPages && (
                    <Link href={`/?page=${page + 1}`}>
                        Trang sau →
                    </Link>
                )}
            </nav>
        </main>
    )
}
