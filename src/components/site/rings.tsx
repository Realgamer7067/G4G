/** The interlocking-rings motif taken from the logo's double G. Decorative. */
export function Rings({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 620 620" className={className} fill="none">
      <circle cx="230" cy="310" r="190" stroke="#2F8D46" strokeOpacity=".45" strokeWidth="1.2" />
      <circle cx="390" cy="310" r="190" stroke="#2F8D46" strokeOpacity=".45" strokeWidth="1.2" />
      <circle cx="230" cy="310" r="260" stroke="#23392C" />
      <circle cx="390" cy="310" r="260" stroke="#23392C" />
    </svg>
  );
}
