export function SkipLink(props: { href: string; label?: string }) {
  return (
    <a className="skip-link" href={props.href}>
      {props.label ?? 'Skip to content'}
    </a>
  );
}
