import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart as faHeartSolid } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';

/** Single heart silhouette used everywhere in the app for favorite/like/
 *  bookmark state — solid when active, outline when not. The Map tab's place
 *  detail sheet is the reference design this matches. Visual-only: click
 *  handling, aria-label, and button sizing/color stay with each caller
 *  (color comes from the caller's text-* class via currentColor, same as
 *  every other icon in the app). */
export default function FavoriteHeartIcon({ active, size = 18, className, ...rest }) {
  return (
    <FontAwesomeIcon
      icon={active ? faHeartSolid : faHeartRegular}
      className={className}
      style={{ width: size, height: size }}
      {...rest}
    />
  );
}
