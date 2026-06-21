const AVATAR_GRADIENTS = [
  'from-amber to-coral',
  'from-[#5FB8E8] to-green',
  'from-[#B58BE0] to-coral',
  'from-green to-[#5FB8E8]',
];

/** Returns a stable Tailwind gradient class based on a user/author identifier string. */
export function avatarGradient(id) {
  if (!id) return AVATAR_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}
