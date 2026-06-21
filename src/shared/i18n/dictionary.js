/** EN/KO translation dictionary for Stage 1 (Map core UI).
 *  Edit strings here directly — keys are stable, values are what users see. */
export const DICTIONARY = {
  en: {
    nearby: {
      header: 'Eat near {location}',
      todayPicks: "★ Today's picks",
      loading: 'Finding routes nearby…',
      empty: 'No routes found nearby.',
      emptyHint: 'Try another area or remove some filters.',
    },
    courseDetail: {
      label: "★ Today's pick",
      stops: '{n} stops',
      blurb: 'A short food walk near {location}.',
      routeStops: 'Route stops',
      restaurantFallback: 'Restaurant',
    },
    placeDetail: {
      menu: 'MENU',
      visitInfo: 'VISIT INFO',
      main: 'Main',
      serves: 'Serves',
      hours: 'Hours',
      restDay: 'Rest day',
      phone: 'Phone',
      parking: 'Parking',
      takeout: 'Takeout',
      distFrom: '{dist} from {location}',
    },
    filter: {
      title: 'Filters',
      reset: 'Reset',
      foodType: 'Food type',
      price: 'Price',
      goodFor: 'Good for',
      catLimit: 'You can select up to 3 food types.',
      showResults: 'Show results',
    },
    language: {
      title: 'Language',
    },
    gps: {
      denied: {
        title: 'Location permission is needed to use your current location.',
        body: 'Please allow location access in your browser settings and try again.',
      },
      error: {
        title: 'Could not get your current location.',
        body: 'Please try again.',
      },
      unsupported: {
        title: 'Location is not supported in this browser.',
        body: null,
      },
    },
    courseTitle: {
      cafeAndBites: '{location} Cafe & Bites',
      streetFood: '{location} Street Food Tour',
      bbq: '{location} Korean BBQ Route',
      noodle: '{location} Noodle Walk',
      default: '{location} Food Walk',
    },
  },

  ko: {
    nearby: {
      header: '{location} 근처 맛집',
      todayPicks: '★ 오늘의 추천',
      loading: '근처 동선을 찾고 있어요…',
      empty: '근처 추천 동선을 찾지 못했습니다.',
      emptyHint: '다른 지역을 선택하거나 필터를 조정해보세요.',
    },
    courseDetail: {
      label: '★ 오늘의 추천',
      stops: '{n}곳',
      blurb: '{location} 근처 짧은 맛집 동선입니다.',
      routeStops: '경로',
      restaurantFallback: '식당',
    },
    placeDetail: {
      menu: '메뉴',
      visitInfo: '방문 정보',
      main: '대표 메뉴',
      serves: '추천 메뉴',
      hours: '영업시간',
      restDay: '휴무일',
      phone: '전화',
      parking: '주차',
      takeout: '포장',
      distFrom: '{location}에서 {dist}',
    },
    filter: {
      title: '필터',
      reset: '초기화',
      foodType: '음식 종류',
      price: '가격대',
      goodFor: '이런 분께',
      catLimit: '음식 종류는 최대 3개까지 선택할 수 있어요.',
      showResults: '결과 보기',
    },
    language: {
      title: '언어 선택',
    },
    gps: {
      denied: {
        title: '현재 위치를 사용하려면 위치 권한이 필요합니다.',
        body: '브라우저 설정에서 위치 접근을 허용한 후 다시 시도해주세요.',
      },
      error: {
        title: '현재 위치를 가져올 수 없습니다.',
        body: '다시 시도해주세요.',
      },
      unsupported: {
        title: '이 브라우저에서는 위치 기능을 지원하지 않습니다.',
        body: null,
      },
    },
    courseTitle: {
      cafeAndBites: '{location} 카페 & 맛집',
      streetFood: '{location} 길거리 음식 탐방',
      bbq: '{location} 한국식 BBQ 동선',
      noodle: '{location} 면 요리 동선',
      default: '{location} 맛집 동선',
    },
  },
};
