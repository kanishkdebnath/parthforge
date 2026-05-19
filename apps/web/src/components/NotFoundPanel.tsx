import { Link } from 'react-router-dom';

interface Props {
  title?: string;
  detail?: string;
  backHref?: string;
  backLabel?: string;
}

export function NotFoundPanel({
  title = 'Not found.',
  detail = 'This page no longer exists, or you do not have access.',
  backHref = '/roadmaps',
  backLabel = 'Back to roadmaps',
}: Props) {
  return (
    <main className="container py-20 max-w-xl">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-3 text-slate-600">{detail}</p>
      <Link
        to={backHref}
        className="mt-8 inline-block text-sm text-slate-900 underline underline-offset-4 hover:text-brand"
      >
        {backLabel}
      </Link>
    </main>
  );
}
