import type { ComponentType } from "react";
import { Fragment } from "react";
import AcademicCapIcon from "react-native-heroicons/outline/AcademicCapIcon";
import ArrowRightOnRectangleIcon from "react-native-heroicons/outline/ArrowRightOnRectangleIcon";
import ArrowTrendingDownIcon from "react-native-heroicons/outline/ArrowTrendingDownIcon";
import ArrowTrendingUpIcon from "react-native-heroicons/outline/ArrowTrendingUpIcon";
import ArrowsPointingInIcon from "react-native-heroicons/outline/ArrowsPointingInIcon";
import ArrowsUpDownIcon from "react-native-heroicons/outline/ArrowsUpDownIcon";
import AtSymbolIcon from "react-native-heroicons/outline/AtSymbolIcon";
import BackwardIcon from "react-native-heroicons/outline/BackwardIcon";
import BanknotesIcon from "react-native-heroicons/outline/BanknotesIcon";
import Bars3CenterLeftIcon from "react-native-heroicons/outline/Bars3CenterLeftIcon";
import Battery50Icon from "react-native-heroicons/outline/Battery50Icon";
import BeakerIcon from "react-native-heroicons/outline/BeakerIcon";
import BellAlertIcon from "react-native-heroicons/outline/BellAlertIcon";
import BellSlashIcon from "react-native-heroicons/outline/BellSlashIcon";
import BellSnoozeIcon from "react-native-heroicons/outline/BellSnoozeIcon";
import BoltIcon from "react-native-heroicons/outline/BoltIcon";
import BookOpenIcon from "react-native-heroicons/outline/BookOpenIcon";
import BookmarkIcon from "react-native-heroicons/outline/BookmarkIcon";
import BriefcaseIcon from "react-native-heroicons/outline/BriefcaseIcon";
import BugAntIcon from "react-native-heroicons/outline/BugAntIcon";
import BuildingOffice2Icon from "react-native-heroicons/outline/BuildingOffice2Icon";
import BuildingStorefrontIcon from "react-native-heroicons/outline/BuildingStorefrontIcon";
import CakeIcon from "react-native-heroicons/outline/CakeIcon";
import CalculatorIcon from "react-native-heroicons/outline/CalculatorIcon";
import CalendarDaysIcon from "react-native-heroicons/outline/CalendarDaysIcon";
import CameraIcon from "react-native-heroicons/outline/CameraIcon";
import ChatBubbleLeftRightIcon from "react-native-heroicons/outline/ChatBubbleLeftRightIcon";
import ChatBubbleOvalLeftEllipsisIcon from "react-native-heroicons/outline/ChatBubbleOvalLeftEllipsisIcon";
import CheckCircleIcon from "react-native-heroicons/outline/CheckCircleIcon";
import ClockIcon from "react-native-heroicons/outline/ClockIcon";
import CloudIcon from "react-native-heroicons/outline/CloudIcon";
import CodeBracketIcon from "react-native-heroicons/outline/CodeBracketIcon";
import CogIcon from "react-native-heroicons/outline/CogIcon";
import CommandLineIcon from "react-native-heroicons/outline/CommandLineIcon";
import ComputerDesktopIcon from "react-native-heroicons/outline/ComputerDesktopIcon";
import CreditCardIcon from "react-native-heroicons/outline/CreditCardIcon";
import DevicePhoneMobileIcon from "react-native-heroicons/outline/DevicePhoneMobileIcon";
import DocumentIcon from "react-native-heroicons/outline/DocumentIcon";
import EnvelopeIcon from "react-native-heroicons/outline/EnvelopeIcon";
import ExclamationTriangleIcon from "react-native-heroicons/outline/ExclamationTriangleIcon";
import EyeSlashIcon from "react-native-heroicons/outline/EyeSlashIcon";
import FilmIcon from "react-native-heroicons/outline/FilmIcon";
import FingerPrintIcon from "react-native-heroicons/outline/FingerPrintIcon";
import FlagIcon from "react-native-heroicons/outline/FlagIcon";
import GiftIcon from "react-native-heroicons/outline/GiftIcon";
import GlobeAltIcon from "react-native-heroicons/outline/GlobeAltIcon";
import GlobeEuropeAfricaIcon from "react-native-heroicons/outline/GlobeEuropeAfricaIcon";
import HashtagIcon from "react-native-heroicons/outline/HashtagIcon";
import HeartIcon from "react-native-heroicons/outline/HeartIcon";
import HomeIcon from "react-native-heroicons/outline/HomeIcon";
import HomeModernIcon from "react-native-heroicons/outline/HomeModernIcon";
import KeyIcon from "react-native-heroicons/outline/KeyIcon";
import LanguageIcon from "react-native-heroicons/outline/LanguageIcon";
import LightBulbIcon from "react-native-heroicons/outline/LightBulbIcon";
import ListBulletIcon from "react-native-heroicons/outline/ListBulletIcon";
import MapIcon from "react-native-heroicons/outline/MapIcon";
import MoonIcon from "react-native-heroicons/outline/MoonIcon";
import MusicalNoteIcon from "react-native-heroicons/outline/MusicalNoteIcon";
import NewspaperIcon from "react-native-heroicons/outline/NewspaperIcon";
import PaintBrushIcon from "react-native-heroicons/outline/PaintBrushIcon";
import PencilIcon from "react-native-heroicons/outline/PencilIcon";
import PhoneIcon from "react-native-heroicons/outline/PhoneIcon";
import PresentationChartBarIcon from "react-native-heroicons/outline/PresentationChartBarIcon";
import PuzzlePieceIcon from "react-native-heroicons/outline/PuzzlePieceIcon";
import QrCodeIcon from "react-native-heroicons/outline/QrCodeIcon";
import RocketLaunchIcon from "react-native-heroicons/outline/RocketLaunchIcon";
import ScaleIcon from "react-native-heroicons/outline/ScaleIcon";
import ShareIcon from "react-native-heroicons/outline/ShareIcon";
import ShoppingBagIcon from "react-native-heroicons/outline/ShoppingBagIcon";
import ShoppingCartIcon from "react-native-heroicons/outline/ShoppingCartIcon";
import SparklesIcon from "react-native-heroicons/outline/SparklesIcon";
import StarIcon from "react-native-heroicons/outline/StarIcon";
import SunIcon from "react-native-heroicons/outline/SunIcon";
import TicketIcon from "react-native-heroicons/outline/TicketIcon";
import TrophyIcon from "react-native-heroicons/outline/TrophyIcon";
import TruckIcon from "react-native-heroicons/outline/TruckIcon";
import TvIcon from "react-native-heroicons/outline/TvIcon";
import UserIcon from "react-native-heroicons/outline/UserIcon";
import UsersIcon from "react-native-heroicons/outline/UsersIcon";
import VariableIcon from "react-native-heroicons/outline/VariableIcon";
import WrenchIcon from "react-native-heroicons/outline/WrenchIcon";

import {
  BabyBottleIcon,
  BallIcon,
  BeachIcon,
  BikeIcon,
  CarIcon,
  CoffeeIcon,
  DumbbellIcon,
  FoodIcon,
  GamepadIcon,
  MountainIcon,
  PawIcon,
  PillIcon,
  PlaneIcon,
  PlantIcon,
  ReceiptIcon,
  ShirtIcon,
  ToothIcon,
  WineIcon,
} from "@/components/icons/everydayIcons";

export interface CategoryMapEntry {
  name: string;
  Icon: ComponentType<any>;
}

export const CATEGORY_MAP: Record<string, CategoryMapEntry> = {
  none: { name: "none", Icon: Fragment },
  user: { name: "user", Icon: UserIcon },
  at: { name: "at", Icon: AtSymbolIcon },
  study: { name: "study", Icon: AcademicCapIcon },
  bank: { name: "bank", Icon: BanknotesIcon },
  text: { name: "text", Icon: Bars3CenterLeftIcon },
  alert: { name: "alert", Icon: BellAlertIcon },
  quick: { name: "quick", Icon: BoltIcon },
  bookmark: { name: "bookmark", Icon: BookmarkIcon },
  office: { name: "office", Icon: BuildingOffice2Icon },
  birthday: { name: "birthday", Icon: CakeIcon },
  calculus: { name: "calculus", Icon: CalculatorIcon },
  calendar: { name: "calendar", Icon: CalendarDaysIcon },
  camera: { name: "camera", Icon: CameraIcon },
  chart: { name: "chart", Icon: PresentationChartBarIcon },
  check: { name: "check", Icon: CheckCircleIcon },
  chat: { name: "chat", Icon: ChatBubbleOvalLeftEllipsisIcon },
  clock: { name: "clock", Icon: ClockIcon },
  settings: { name: "settings", Icon: CogIcon },
  code: { name: "code", Icon: CodeBracketIcon },
  cloud: { name: "cloud", Icon: CloudIcon },
  card: { name: "card", Icon: CreditCardIcon },
  cmd: { name: "cmd", Icon: CommandLineIcon },
  computer: { name: "computer", Icon: ComputerDesktopIcon },
  device: { name: "device", Icon: DevicePhoneMobileIcon },
  document: { name: "document", Icon: DocumentIcon },
  email: { name: "email", Icon: EnvelopeIcon },
  finger: { name: "finger", Icon: FingerPrintIcon },
  film: { name: "film", Icon: FilmIcon },
  secret: { name: "secret", Icon: EyeSlashIcon },
  warning: { name: "warning", Icon: ExclamationTriangleIcon },
  flag: { name: "flag", Icon: FlagIcon },
  gift: { name: "gift", Icon: GiftIcon },
  hash: { name: "hash", Icon: HashtagIcon },
  heart: { name: "heart", Icon: HeartIcon },
  home: { name: "home", Icon: HomeIcon },
  light: { name: "light", Icon: LightBulbIcon },
  key: { name: "key", Icon: KeyIcon },
  list: { name: "list", Icon: ListBulletIcon },
  moon: { name: "moon", Icon: MoonIcon },
  music: { name: "music", Icon: MusicalNoteIcon },
  phone: { name: "phone", Icon: PhoneIcon },
  qr: { name: "qr", Icon: QrCodeIcon },
  rocket: { name: "rocket", Icon: RocketLaunchIcon },
  shop: { name: "shop", Icon: ShoppingCartIcon },
  share: { name: "share", Icon: ShareIcon },
  star: { name: "star", Icon: StarIcon },
  trendup: { name: "trendup", Icon: ArrowTrendingUpIcon },
  trenddown: { name: "trenddown", Icon: ArrowTrendingDownIcon },
  exit: { name: "exit", Icon: ArrowRightOnRectangleIcon },
  updown: { name: "updown", Icon: ArrowsUpDownIcon },
  pointing: { name: "pointing", Icon: ArrowsPointingInIcon },
  backward: { name: "backward", Icon: BackwardIcon },
  battery: { name: "battery", Icon: Battery50Icon },
  beaker: { name: "beaker", Icon: BeakerIcon },
  bellslash: { name: "bellslash", Icon: BellSlashIcon },
  bellsnooze: { name: "bellsnooze", Icon: BellSnoozeIcon },
  bookopen: { name: "bookopen", Icon: BookOpenIcon },
  storefront: { name: "storefront", Icon: BuildingStorefrontIcon },
  bugant: { name: "bugant", Icon: BugAntIcon },
  chatbubble: { name: "chatbubble", Icon: ChatBubbleLeftRightIcon },
  globe: { name: "globe", Icon: GlobeAltIcon },
  globeeurope: { name: "globeeurope", Icon: GlobeEuropeAfricaIcon },
  homemodern: { name: "homemodern", Icon: HomeModernIcon },
  pencil: { name: "pencil", Icon: PencilIcon },
  sparkles: { name: "sparkles", Icon: SparklesIcon },
  trophy: { name: "trophy", Icon: TrophyIcon },
  wrench: { name: "wrench", Icon: WrenchIcon },
  variable: { name: "variable", Icon: VariableIcon },
  truck: { name: "truck", Icon: TruckIcon },
  // Everyday topics (2026-11-17): heroicons where they draw one, the others in `everydayIcons` (same style).
  family: { name: "family", Icon: UsersIcon },
  work: { name: "work", Icon: BriefcaseIcon },
  food: { name: "food", Icon: FoodIcon },
  coffee: { name: "coffee", Icon: CoffeeIcon },
  bag: { name: "bag", Icon: ShoppingBagIcon },
  pill: { name: "pill", Icon: PillIcon },
  fitness: { name: "fitness", Icon: DumbbellIcon },
  sport: { name: "sport", Icon: BallIcon },
  bike: { name: "bike", Icon: BikeIcon },
  car: { name: "car", Icon: CarIcon },
  plane: { name: "plane", Icon: PlaneIcon },
  map: { name: "map", Icon: MapIcon },
  ticket: { name: "ticket", Icon: TicketIcon },
  pet: { name: "pet", Icon: PawIcon },
  plant: { name: "plant", Icon: PlantIcon },
  clothes: { name: "clothes", Icon: ShirtIcon },
  gamepad: { name: "gamepad", Icon: GamepadIcon },
  news: { name: "news", Icon: NewspaperIcon },
  law: { name: "law", Icon: ScaleIcon },
  art: { name: "art", Icon: PaintBrushIcon },
  weather: { name: "weather", Icon: SunIcon },
  beach: { name: "beach", Icon: BeachIcon },
  mountain: { name: "mountain", Icon: MountainIcon },
  baby: { name: "baby", Icon: BabyBottleIcon },
  dentist: { name: "dentist", Icon: ToothIcon },
  wine: { name: "wine", Icon: WineIcon },
  bills: { name: "bills", Icon: ReceiptIcon },
  tv: { name: "tv", Icon: TvIcon },
  language: { name: "language", Icon: LanguageIcon },
  hobby: { name: "hobby", Icon: PuzzlePieceIcon },
};
