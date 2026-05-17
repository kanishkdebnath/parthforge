import { Link } from 'react-router-dom';

interface Props {
  title?: string;
  detail?: string;
}

export function NotFoundPanel({
  title = 'Not found.',
  detail = 'This page no longer exists, or you do not have access.',
}: Props) {
  return (
    <main className="container py-20 max-w-xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-3 text-slate-600">{detail}</p>
      <Link
        to="/roadmaps"
        className="mt-8 inline-block text-sm text-slate-900 underline underline-offset-4 hover:text-active"
      >
        Back to roadmaps
      </Link>
    </main>
  );
}
