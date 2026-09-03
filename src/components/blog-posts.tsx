import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock3 } from 'lucide-react'
import type { Post } from 'content-collections'

export default function BlogPosts({ posts }:{ posts:Post[] }) {return <div className="article-grid">{[...posts].sort((a,b)=>b.date.localeCompare(a.date)).map((post,index)=><article className={`article-card ${index===0?'featured':''}`} key={post.slug}><Link to={`/blog/${post.slug}`}><div className="article-image"><span>{String(index+1).padStart(2,'0')}</span></div><div className="article-card-copy"><div className="article-meta"><span>{post.categories[0]}</span><span><Clock3 size={13}/>{post.readingTime} min read</span></div><h2>{post.title}</h2><p>{post.summary}</p><strong>Read the guide <ArrowRight size={15}/></strong></div></Link></article>)}</div>}
