import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Place, PlaceList } from '@/app/data/contracts/entities';
import {
  X, MapPin, Navigation, Star, ChevronRight, ChevronLeft,
  Clock, Camera, StickyNote, Tag, DollarSign, GraduationCap,
  Sun, Sparkles, Check, Plus, Heart, Share2, Trash2, Users,
  GripVertical, Image as ImageIcon, StarHalf, Globe, Lock,
  Minus, Maximize2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────
interface PlacePanelProps {
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
  existingPlace?: Place | null;
  existingPlaceListName?: string;
  lists: PlaceList[];
  onClose: () => void;
  onSave: (place: Omit<Place, 'id' | 'addedAt'>, targetListIds: string[]) => void;
  onDelete?: (placeId: string) => void;
  onCreateList?: (list: PlaceList) => void;
}

// ── Constants ─────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'cafe', label: 'Kafe', icon: '☕' },
  { value: 'restaurant', label: 'Restoran', icon: '🍽️' },
  { value: 'fastfood', label: 'Fast Food', icon: '🍔' },
  { value: 'pizzeria', label: 'Pizzacı', icon: '🍕' },
  { value: 'kebab', label: 'Kebapçı', icon: '🥙' },
  { value: 'seafood', label: 'Balık', icon: '🐟' },
  { value: 'sushi', label: 'Suşi', icon: '🍣' },
  { value: 'dessert', label: 'Tatlıcı', icon: '🍰' },
  { value: 'icecream', label: 'Dondurmacı', icon: '🍦' },
  { value: 'bakery', label: 'Fırın/Pastane', icon: '🥐' },
  { value: 'bar', label: 'Bar', icon: '🍸' },
  { value: 'pub', label: 'Pub', icon: '🍺' },
  { value: 'nightclub', label: 'Gece Kulübü', icon: '🪩' },
  { value: 'nightlife', label: 'Gece Hayatı', icon: '🌙' },
  { value: 'park', label: 'Park', icon: '🌳' },
  { value: 'garden', label: 'Botanik Bahçe', icon: '🌺' },
  { value: 'beach', label: 'Plaj', icon: '🏖️' },
  { value: 'lake', label: 'Göl', icon: '🏞️' },
  { value: 'mountain', label: 'Dağ/Doğa', icon: '🏔️' },
  { value: 'campsite', label: 'Kamp Alanı', icon: '⛺' },
  { value: 'museum', label: 'Müze', icon: '🏛️' },
  { value: 'historicsite', label: 'Tarihi Yer', icon: '🏰' },
  { value: 'artgallery', label: 'Sanat Galerisi', icon: '🎨' },
  { value: 'theater', label: 'Tiyatro', icon: '🎭' },
  { value: 'cinema', label: 'Sinema', icon: '🎬' },
  { value: 'concerthall', label: 'Konser Salonu', icon: '🎵' },
  { value: 'library', label: 'Kütüphane', icon: '📚' },
  { value: 'bookstore', label: 'Kitapçı', icon: '📖' },
  { value: 'shopping', label: 'AVM', icon: '🛍️' },
  { value: 'boutique', label: 'Butik', icon: '👗' },
  { value: 'market', label: 'Market', icon: '🏪' },
  { value: 'bazaar', label: 'Çarşı/Pazar', icon: '🧺' },
  { value: 'hotel', label: 'Otel', icon: '🏨' },
  { value: 'hostel', label: 'Hostel', icon: '🛏️' },
  { value: 'spa', label: 'Spa/Hamam', icon: '🧖' },
  { value: 'gym', label: 'Spor Salonu', icon: '🏋️' },
  { value: 'sport', label: 'Spor Tesisi', icon: '⚽' },
  { value: 'pool', label: 'Havuz', icon: '🏊' },
  { value: 'yoga', label: 'Yoga/Pilates', icon: '🧘' },
  { value: 'hospital', label: 'Hastane', icon: '🏥' },
  { value: 'pharmacy', label: 'Eczane', icon: '💊' },
  { value: 'vet', label: 'Veteriner', icon: '🐾' },
  { value: 'mosque', label: 'Cami', icon: '🕌' },
  { value: 'church', label: 'Kilise', icon: '⛪' },
  { value: 'coworking', label: 'Coworking', icon: '💻' },
  { value: 'school', label: 'Okul/Kurs', icon: '🎓' },
  { value: 'playground', label: 'Oyun Alanı', icon: '🎠' },
  { value: 'zoo', label: 'Hayvanat Bahçesi', icon: '🦁' },
  { value: 'aquarium', label: 'Akvaryum', icon: '🐠' },
  { value: 'themepark', label: 'Eğlence Parkı', icon: '🎢' },
  { value: 'viewpoint', label: 'Manzara Noktası', icon: '🌅' },
  { value: 'gasstation', label: 'Benzinlik', icon: '⛽' },
  { value: 'carwash', label: 'Oto Yıkama', icon: '🚗' },
  { value: 'parking', label: 'Otopark', icon: '🅿️' },
  { value: 'ferry', label: 'Vapur/İskele', icon: '⛴️' },
  { value: 'airport', label: 'Havalimanı', icon: '✈️' },
  { value: 'trainstation', label: 'Tren İstasyonu', icon: '🚂' },
  { value: 'other', label: 'Diğer', icon: '📍' },
];

const ATMOSPHERES = [
  'Sakin', 'Enerjik', 'Romantik', 'Aile dostu', 'Çalışmaya uygun',
  'Retro', 'Modern', 'Doğal', 'Lüks', 'Samimi', 'Bohem',
  'Minimalist', 'Rustik', 'Endüstriyel', 'Tropik', 'Vintage',
  'Cozy', 'Artistik', 'Zen', 'Canlı', 'Nostaljik', 'Mistik',
  'Otantik', 'Şık', 'Rahat', 'Eğlenceli', 'Huzurlu', 'Ferah',
  'Sıcak', 'Sofistike', 'Underground', 'Hipster', 'Geleneksel',
  'Eklektik', 'Gotik', 'Futuristik', 'Deniz esintili', 'Orman havası',
  'Steampunk', 'Japon tarzı', 'Akdeniz', 'Kırsal', 'Urban',
];

const SPECIAL_FEATURES = [
  'WiFi', 'Açık alan', 'Otopark', 'Canlı müzik', 'Pet dostu',
  'Vejetaryen menü', 'Vegan menü', 'Gluten-free seçenekler',
  'Engelli erişimi', 'Rezervasyon', 'Paket servis', 'Gel-al',
  'Vale', 'Çocuk oyun alanı', 'Bebek bakım odası', 'Çocuk menüsü',
  'Teras', 'Bahçe', 'Balkon', 'Rooftop',
  'Deniz manzarası', 'Şehir manzarası', 'Boğaz manzarası', 'Orman manzarası',
  'Priz', 'Sessiz alan', 'Kitaplık', 'Board game', 'Nargile',
  'Brunch', 'Kahvaltı', 'Gece açık', '24 saat', 'Self servis',
  'Masa servisi', 'Sigara alanı', 'Klima', 'Isıtma', 'Şömine',
  'Havuz', 'Jakuzi', 'Sauna', 'Türk hamamı',
  'DJ', 'Karaoke', 'Bilardo', 'Dart', 'PlayStation',
  'Projeksiyon', 'Maç yayını', 'Kitap köşesi', 'Çalışma masası',
  'Toplantı odası', 'Ücretsiz park', 'Bisiklet parkı', 'Şarj istasyonu',
  'Organik ürünler', 'Yerel lezzetler', 'Sokak yemeği', 'Fine dining',
  'Meyhane', 'Ocakbaşı', 'Mangal alanı', 'Piknik alanı',
  'Fotoğraf noktası', 'Instagram-worthy', 'Gizli mekan', 'Tarihi bina',
];

const BEST_TIMES = [
  'Sabah', 'Öğlen', 'Öğleden sonra', 'Akşam', 'Gece', 'Gece yarısı',
  'Hafta sonu', 'Hafta içi', 'Her zaman',
  'Yaz', 'Kış', 'İlkbahar', 'Sonbahar',
  'Gün batımı', 'Gün doğumu', 'Bayramlar', 'Tatil günleri',
  'Yağmurlu hava', 'Güneşli hava', 'Ramazan', 'Yılbaşı',
];

// Mock social data
const MOCK_SAVES = [
  { userId: 'user-002', userName: 'Selin Yıldız', listName: 'İstanbul Favorilerim', savedAt: '2026-03-10T14:00:00Z', rating: 5, comment: 'Kesinlikle denenmeli! 🔥' },
  { userId: 'user-003', userName: 'Can Öztürk', listName: 'Kahve Rotası', savedAt: '2026-03-08T10:00:00Z', rating: 4, comment: 'Kahveleri harika, biraz kalabalık olabiliyor.' },
  { userId: 'user-004', userName: 'Elif Şahin', listName: 'Çalışma Mekanları', savedAt: '2026-02-28T09:00:00Z', rating: 4, comment: 'WiFi hızlı, prizler bol.' },
  { userId: 'user-005', userName: 'Deniz Korkmaz', listName: 'Huzur Mekanlari', savedAt: '2026-03-15T11:00:00Z', rating: 5, comment: 'Atmosfer inanılmaz, gitmeden olmaz!' },
  { userId: 'user-006', userName: 'Burak Celik', listName: 'Denenmeli Yerler', savedAt: '2026-03-12T20:00:00Z', rating: 4.5, comment: 'Manzara ve yemek uyumu harika.' },
];

// ── Subcomponents ─────────────────────────────────────────────────

/** Half-star rating: click once=0.5, twice=1.0, third=0 */
function StarRating({ value, onChange, size = 32 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const handleClick = (starIndex: number) => {
    const starNum = starIndex + 1;
    const currentStarValue = value - starIndex; // how much of this star is filled

    if (currentStarValue <= 0) {
      // Empty → half
      onChange(starIndex + 0.5);
    } else if (currentStarValue === 0.5) {
      // Half → full
      onChange(starNum);
    } else {
      // Full → empty (set to previous star's full value)
      onChange(starIndex);
    }
  };

  return (
    <div className="flex gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const starVal = value - i;
        const isFull = starVal >= 1;
        const isHalf = starVal >= 0.5 && starVal < 1;

        return (
          <button
            key={i}
            type="button"
            onClick={() => handleClick(i)}
            className="transition-transform hover:scale-110 active:scale-95 relative"
            style={{ width: size, height: size }}
          >
            {/* Background empty star */}
            <Star
              size={size}
              className="text-gray-200 absolute inset-0"
            />
            {/* Full star */}
            {isFull && (
              <Star
                size={size}
                className="text-amber-400 fill-amber-400 absolute inset-0"
              />
            )}
            {/* Half star - clip left half */}
            {isHalf && (
              <div className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}>
                <Star
                  size={size}
                  className="text-amber-400 fill-amber-400"
                />
              </div>
            )}
          </button>
        );
      })}
      {value > 0 && (
        <span className="text-sm text-amber-600 self-center ml-1" style={{ fontWeight: 600 }}>
          {value}
        </span>
      )}
    </div>
  );
}

function ChipSelector({ options, selected, onToggle, multi = false }: {
  options: string[] | { value: string; label: string; icon?: string }[];
  selected: string | string[];
  onToggle: (val: string) => void;
  multi?: boolean;
}) {
  const isSelected = (val: string) =>
    multi ? (selected as string[]).includes(val) : selected === val;

  const items = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onToggle(item.value)}
          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
            isSelected(item.value)
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={{ fontWeight: 500 }}
        >
          {isSelected(item.value) && <span className="mr-1">✓</span>}
          {'icon' in item && item.icon && <span className="mr-1">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i === current ? 'w-6 bg-blue-500' : i < current ? 'w-3 bg-blue-300' : 'w-3 bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── Draggable Photo Manager ───────────────────────────────────────
function PhotoManager({
  photos,
  onChange,
  maxPhotos = 5,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Touch drag state
  const touchStartRef = useRef<{ index: number; startX: number; startY: number } | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = maxPhotos - photos.length;
    const filesToProcess = Array.from(files).slice(0, remaining);

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        onChange([...photos, result]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  // Mouse drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;

    const newPhotos = [...photos];
    const [moved] = newPhotos.splice(dragIndex, 1);
    newPhotos.splice(dropIndex, 0, moved);
    onChange(newPhotos);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Touch drag handlers for mobile reordering
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { index, startX: touch.clientX, startY: touch.clientY };
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !containerRef.current) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.startX);
    const dy = Math.abs(touch.clientY - touchStartRef.current.startY);

    // Only handle horizontal drag
    if (dx < 10 && dy < 10) return;
    if (dy > dx) return; // vertical scroll

    e.preventDefault();
    setDragIndex(touchStartRef.current.index);

    // Find which item we're over
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
        setDragOverIndex(i);
        break;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const newPhotos = [...photos];
      const [moved] = newPhotos.splice(dragIndex, 1);
      newPhotos.splice(dragOverIndex, 0, moved);
      onChange(newPhotos);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    touchStartRef.current = null;
  }, [dragIndex, dragOverIndex, photos, onChange]);

  return (
    <div className="space-y-3">
      {/* Photo grid */}
      {photos.length > 0 && (
        <div
          ref={containerRef}
          className="flex gap-2 overflow-x-auto pb-2"
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {photos.map((photo, idx) => (
            <div
              key={`photo-${idx}`}
              ref={(el) => { itemRefs.current[idx] = el; }}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(idx, e)}
              className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                dragOverIndex === idx ? 'ring-2 ring-blue-500 scale-105' : ''
              } ${dragIndex === idx ? 'opacity-50' : ''}`}
            >
              <img src={photo} alt="" className="w-full h-full object-cover" />
              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center"
              >
                <X className="size-3 text-white" />
              </button>
              {/* Order indicator */}
              <div className="absolute bottom-0.5 left-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                <span className="text-[9px] text-white" style={{ fontWeight: 700 }}>{idx + 1}</span>
              </div>
              {/* Drag handle */}
              <div className="absolute top-0.5 left-0.5 p-0.5">
                <GripVertical className="size-3 text-white/70" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {photos.length < maxPhotos && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-all"
          >
            <Camera className="size-5" />
            Fotoğraf Ekle ({photos.length}/{maxPhotos})
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </>
      )}

      {photos.length > 1 && (
        <p className="text-[10px] text-gray-400 text-center">
          Sırayı değiştirmek için basılı tut ve sürükle
        </p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export function PlacePanel({
  lat, lng, placeName, placeAddress,
  existingPlace, existingPlaceListName,
  lists, onClose, onSave, onDelete, onCreateList
}: PlacePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isExisting = !!existingPlace;

  // Panel state
  const [showAddWizard, setShowAddWizard] = useState(!isExisting);
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  // Form data
  const [name, setName] = useState(placeName || existingPlace?.name || '');
  const [address, setAddress] = useState(placeAddress || existingPlace?.address || '');
  const [rating, setRating] = useState(existingPlace?.rating || 0);
  const [categories, setCategories] = useState<string[]>(
    existingPlace?.categories || (existingPlace?.category ? [existingPlace.category] : [])
  );
  const [studentDiscount, setStudentDiscount] = useState(existingPlace?.studentDiscount || false);
  const [priceMin, setPriceMin] = useState(existingPlace?.priceMin?.toString() || '');
  const [priceMax, setPriceMax] = useState(existingPlace?.priceMax?.toString() || '');
  const [bestTimes, setBestTimes] = useState<string[]>(
    existingPlace?.bestTimes || (existingPlace?.bestTime ? [existingPlace.bestTime] : [])
  );
  const [atmosphere, setAtmosphere] = useState<string[]>(existingPlace?.atmosphere || []);
  const [specialFeatures, setSpecialFeatures] = useState<string[]>(existingPlace?.specialFeatures || []);
  const [title, setTitle] = useState(existingPlace?.title || '');
  const [notes, setNotes] = useState(existingPlace?.notes || '');
  const [photos, setPhotos] = useState<string[]>(existingPlace?.photos || []);

  // New list creation form
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListEmoji, setNewListEmoji] = useState('');
  const [newListIsPublic, setNewListIsPublic] = useState(true);
  const [newListCoverImage, setNewListCoverImage] = useState('');
  const newListCoverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(placeName || existingPlace?.name || '');
    setAddress(placeAddress || existingPlace?.address || '');
  }, [placeName, placeAddress, existingPlace]);

  const WIZARD_STEPS = [
    { title: 'Temel Bilgiler', subtitle: 'Puan ve kategori' },
    { title: 'Detaylar', subtitle: 'Fiyat ve zaman' },
    { title: 'Atmosfer', subtitle: 'Ortam ve özellikler' },
    { title: 'Son Adım', subtitle: 'Fotoğraf, not ve liste' },
  ];

  const toggleCategory = (val: string) => {
    setCategories(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  };

  const toggleBestTime = (val: string) => {
    setBestTimes(prev =>
      prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]
    );
  };

  const toggleAtmosphere = (val: string) => {
    setAtmosphere(prev =>
      prev.includes(val) ? prev.filter(a => a !== val) : [...prev, val]
    );
  };

  const toggleSpecialFeature = (val: string) => {
    setSpecialFeatures(prev =>
      prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]
    );
  };

  const toggleList = (listId: string) => {
    setSelectedListIds(prev =>
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (selectedListIds.length === 0) return;
    onSave({
      name: name.trim(),
      title: title || undefined,
      lat, lng,
      address: address || undefined,
      notes: notes || undefined,
      rating: rating || undefined,
      category: categories[0] || undefined,
      categories: categories.length > 0 ? categories : undefined,
      studentDiscount,
      priceMin: priceMin ? parseInt(priceMin) : undefined,
      priceMax: priceMax ? parseInt(priceMax) : undefined,
      priceRange: priceMin && priceMax
        ? (parseInt(priceMax) <= 50 ? 1 : parseInt(priceMax) <= 100 ? 2 : parseInt(priceMax) <= 200 ? 3 : 4)
        : undefined,
      bestTime: bestTimes[0] || undefined,
      bestTimes: bestTimes.length > 0 ? bestTimes : undefined,
      atmosphere: atmosphere.length > 0 ? atmosphere : undefined,
      specialFeatures: specialFeatures.length > 0 ? specialFeatures : undefined,
      photos: photos.length > 0 ? photos : undefined,
    }, selectedListIds);
  };

  const handleNavigate = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank'
    );
  };

  const socialSaves = isExisting ? MOCK_SAVES.slice(0, Math.floor(Math.random() * 3) + 1) : [];

  // ── Wizard step content ─────────────────────────────────────────
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 0:
        return (
          <div className="space-y-5">
            {!isExisting && (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                    Mekan Adı *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Sevdiğim Kafe"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                    Adres
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Örn: Kadıköy, İstanbul"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
              </>
            )}

            {/* Rating */}
            <div className="space-y-3">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Puanın (yarım yıldız için bir kez, tam yıldız için iki kez tıkla)
              </label>
              <StarRating value={rating} onChange={setRating} size={32} />
            </div>

            {/* Categories - multi select, horizontally scrollable rows */}
            <div className="space-y-3">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Kategoriler (birden fazla seçilebilir) — kaydır →
              </label>
              <div className="overflow-x-auto -mx-5 px-5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="grid grid-rows-3 grid-flow-col gap-2 pb-1" style={{ width: 'max-content' }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16 ${
                        categories.includes(cat.value)
                          ? 'bg-blue-50 ring-2 ring-blue-500'
                          : 'bg-gray-50 active:bg-gray-100'
                      }`}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-[8px] text-gray-600 text-center leading-tight" style={{ fontWeight: 500 }}>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {categories.length > 0 && (
                <p className="text-[10px] text-blue-500">
                  {categories.length} kategori seçildi
                </p>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-5">
            {/* Student Discount */}
            <div className="space-y-3">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Öğrenci İndirimi Var mı?
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStudentDiscount(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all ${
                    studentDiscount
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <GraduationCap className="size-4" />
                  Evet
                </button>
                <button
                  type="button"
                  onClick={() => setStudentDiscount(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all ${
                    !studentDiscount
                      ? 'bg-gray-700 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  Hayır
                </button>
              </div>
            </div>

            {/* Price Range - numeric input */}
            <div className="space-y-3">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Fiyat Aralığı (₺)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₺</span>
                  <input
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="Min"
                    className="w-full pl-8 pr-3 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <span className="text-gray-400 text-sm">—</span>
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₺</span>
                  <input
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="Max"
                    className="w-full pl-8 pr-3 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              {priceMin && priceMax && (
                <p className="text-[10px] text-emerald-600">
                  Kişi başı ortalama: ₺{priceMin} - ₺{priceMax}
                </p>
              )}
            </div>

            {/* Best Time - multi select */}
            <div className="space-y-3">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                En İyi Zamanlar (birden fazla seçilebilir)
              </label>
              <ChipSelector
                options={BEST_TIMES}
                selected={bestTimes}
                onToggle={toggleBestTime}
                multi
              />
              {bestTimes.length > 0 && (
                <p className="text-[10px] text-blue-500">
                  {bestTimes.length} zaman seçildi
                </p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            {/* Atmosphere */}
            <div className="space-y-3">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Atmosfer (birden fazla seçilebilir)
              </label>
              <ChipSelector
                options={ATMOSPHERES}
                selected={atmosphere}
                onToggle={toggleAtmosphere}
                multi
              />
              {atmosphere.length > 0 && (
                <p className="text-[10px] text-blue-500">
                  {atmosphere.length} seçildi
                </p>
              )}
            </div>

            {/* Special Features */}
            <div className="space-y-3">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Özellikler (birden fazla seçilebilir)
              </label>
              <ChipSelector
                options={SPECIAL_FEATURES}
                selected={specialFeatures}
                onToggle={toggleSpecialFeature}
                multi
              />
              {specialFeatures.length > 0 && (
                <p className="text-[10px] text-blue-500">
                  {specialFeatures.length} seçildi
                </p>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Başlık
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mekan için kısa bir başlık..."
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Notların
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bu mekan hakkında notlarını yaz..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200 transition-all resize-none"
              />
            </div>

            {/* Photos with preview and reorder */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Fotoğraflar (en fazla 5)
              </label>
              <PhotoManager
                photos={photos}
                onChange={setPhotos}
                maxPhotos={5}
              />
            </div>

            {/* List selection */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
                Hangi listeye eklensin? *
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => toggleList(list.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      selectedListIds.includes(list.id)
                        ? 'bg-blue-50 ring-2 ring-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`size-5 rounded-full flex items-center justify-center ${
                      selectedListIds.includes(list.id) ? 'bg-blue-500' : 'bg-gray-200'
                    }`}>
                      {selectedListIds.includes(list.id) && (
                        <Check className="size-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ fontWeight: 500 }}>{list.name}</p>
                      <p className="text-xs text-gray-400">{list.places.length} mekan</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* New list creation */}
              {!showNewListForm ? (
                <button
                  type="button"
                  onClick={() => setShowNewListForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-all"
                >
                  <Plus className="size-4" />
                  Yeni Liste Oluştur
                </button>
              ) : (
                <div className="space-y-2.5 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-emerald-700" style={{ fontWeight: 600 }}>
                      Yeni Liste
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewListForm(false)}
                      className="p-0.5 rounded hover:bg-emerald-100"
                    >
                      <X className="size-3.5 text-emerald-500" />
                    </button>
                  </div>
                  {/* Cover photo */}
                  {newListCoverImage ? (
                    <div className="relative h-20 rounded-xl overflow-hidden">
                      <img src={newListCoverImage} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setNewListCoverImage('')} className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                        <X className="size-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => newListCoverRef.current?.click()} className="w-full flex items-center justify-center gap-1.5 py-3 border border-dashed border-emerald-200 rounded-xl text-[11px] text-emerald-500 hover:bg-emerald-50 transition-colors">
                      <ImageIcon className="size-3.5" /> Kapak Fotoğrafı Seç
                    </button>
                  )}
                  <input ref={newListCoverRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setNewListCoverImage(ev.target?.result as string);
                    reader.readAsDataURL(file);
                    if (newListCoverRef.current) newListCoverRef.current.value = '';
                  }} />
                  <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Liste adı *" className="w-full px-3 py-2 bg-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
                  <textarea value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="Açıklama (opsiyonel)"
                    rows={2}
                    className="w-full px-3 py-2 bg-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewListIsPublic(true)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-all ${
                        newListIsPublic ? 'bg-emerald-500 text-white' : 'bg-white text-gray-500'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      <Globe className="size-3" />
                      Herkese Açık
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewListIsPublic(false)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-all ${
                        !newListIsPublic ? 'bg-gray-700 text-white' : 'bg-white text-gray-500'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      <Lock className="size-3" />
                      Özel
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!newListName.trim()}
                    onClick={() => {
                      const newList: PlaceList = {
                        id: `list-${Date.now()}`,
                        userId: '',
                        name: newListName.trim(),
                        description: newListDescription || undefined,
                        emoji: newListEmoji || undefined,
                        coverImage: newListCoverImage || undefined,
                        places: [],
                        isPublic: newListIsPublic,
                        likes: 0,
                        likedBy: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      };
                      onCreateList?.(newList);
                      setSelectedListIds(prev => [...prev, newList.id]);
                      setShowNewListForm(false);
                      setNewListName('');
                      setNewListDescription('');
                      setNewListEmoji('');
                      setNewListCoverImage('');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white rounded-xl text-xs hover:bg-emerald-600 transition-colors disabled:opacity-40"
                    style={{ fontWeight: 600 }}
                  >
                    <Check className="size-3.5" />
                    Liste Oluştur
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Social feed card ────────────────────────────────────────────
  const renderSocialFeed = () => {
    if (socialSaves.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-gray-400" />
          <span className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
            Bu mekanı kaydeden kişiler
          </span>
        </div>
        <div className="space-y-2.5">
          {socialSaves.map((save, idx) => (
            <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="size-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs" style={{ fontWeight: 600 }}>
                  {save.userName.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm truncate" style={{ fontWeight: 600 }}>{save.userName}</span>
                  <div className="flex">
                    {Array.from({ length: save.rating }).map((_, i) => (
                      <Star key={i} className="size-3 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {save.listName} • {new Date(save.savedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </p>
                {save.comment && (
                  <p className="text-xs text-gray-600 mt-1.5">{save.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 z-[1001] flex flex-col justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] pointer-events-auto flex flex-col transition-all duration-300 ${isMinimized ? 'max-h-[80px]' : 'max-h-[85vh]'}`}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Minimize & Close buttons */}
        <div className="absolute top-3 right-4 flex items-center gap-1 z-10">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-full active:bg-gray-100 transition-colors"
          >
            {isMinimized ? <Maximize2 className="size-4 text-gray-400" /> : <Minus className="size-5 text-gray-400" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full active:bg-gray-100 transition-colors"
          >
            <X className="size-5 text-gray-400" />
          </button>
        </div>

        {/* Minimized header */}
        {isMinimized && (
          <div className="px-5 pb-3">
            <p className="text-sm truncate pr-16" style={{ fontWeight: 600 }}>
              {isExisting ? existingPlace!.name : (name || 'Yeni Mekan')}
            </p>
          </div>
        )}

        {/* Scrollable content */}
        {!isMinimized && (
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {/* Header: Place info */}
          <div className="pt-2 pb-4">
            <h2 className="text-lg pr-8" style={{ fontWeight: 700 }}>
              {isExisting ? existingPlace!.name : (name || 'Yeni Mekan')}
            </h2>
            {(address || existingPlace?.address) && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <MapPin className="size-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-500">{address || existingPlace?.address}</p>
              </div>
            )}
            {!isExisting && !address && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <MapPin className="size-3.5 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-400">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
              </div>
            )}

            {isExisting && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {existingPlaceListName && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs" style={{ fontWeight: 500 }}>
                    {existingPlaceListName}
                  </span>
                )}
                {existingPlace!.category && (
                  <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs" style={{ fontWeight: 500 }}>
                    {CATEGORIES.find(c => c.value === existingPlace!.category)?.icon}{' '}
                    {CATEGORIES.find(c => c.value === existingPlace!.category)?.label}
                  </span>
                )}
                {existingPlace!.rating && existingPlace!.rating > 0 && (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-xs flex items-center gap-1" style={{ fontWeight: 500 }}>
                    <Star className="size-3 fill-amber-500 text-amber-500" />
                    {existingPlace!.rating}
                  </span>
                )}
                {existingPlace!.studentDiscount && (
                  <span className="px-2.5 py-1 bg-sky-50 text-sky-600 rounded-full text-xs flex items-center gap-1" style={{ fontWeight: 500 }}>
                    <GraduationCap className="size-3" /> İndirim
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Existing place details */}
          {isExisting && !showAddWizard && (
            <div className="space-y-4">
              {(existingPlace!.bestTime || existingPlace!.atmosphere?.length || existingPlace!.notes) && (
                <div className="space-y-2.5 p-3.5 bg-gray-50 rounded-xl">
                  {existingPlace!.bestTime && (
                    <div className="flex items-center gap-2.5">
                      <Clock className="size-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-600">En iyi zaman: {existingPlace!.bestTime}</p>
                    </div>
                  )}
                  {existingPlace!.atmosphere && existingPlace!.atmosphere.length > 0 && (
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {existingPlace!.atmosphere.map(a => (
                          <span key={a} className="px-2 py-0.5 bg-white rounded-full text-xs text-gray-500">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {existingPlace!.notes && (
                    <div className="flex items-start gap-2.5">
                      <StickyNote className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600">{existingPlace!.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {existingPlace!.specialFeatures && existingPlace!.specialFeatures.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {existingPlace!.specialFeatures.map(f => (
                    <span key={f} className="px-2.5 py-1 bg-blue-50 text-blue-500 rounded-full text-xs" style={{ fontWeight: 500 }}>{f}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleNavigate}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  <Navigation className="size-4" />
                  Yol Tarifi
                </button>
                <button
                  onClick={() => setShowAddWizard(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl text-sm hover:bg-emerald-600 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="size-4" />
                  Listeye Ekle
                </button>
              </div>

              {onDelete && (
                <button
                  onClick={() => onDelete(existingPlace!.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm hover:bg-red-100 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <Trash2 className="size-4" />
                  Sil
                </button>
              )}

              {renderSocialFeed()}
            </div>
          )}

          {/* Add Wizard */}
          {showAddWizard && (
            <div className="space-y-4">
              {/* Step header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ fontWeight: 600 }}>{WIZARD_STEPS[wizardStep].title}</p>
                  <p className="text-xs text-gray-400">{WIZARD_STEPS[wizardStep].subtitle}</p>
                </div>
                <StepIndicator current={wizardStep} total={WIZARD_STEPS.length} />
              </div>

              {/* Step content */}
              <div className="min-h-[200px]">
                {renderWizardStep()}
              </div>

              {/* Navigation */}
              <div className="flex gap-2 pt-2">
                {wizardStep > 0 ? (
                  <button
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="flex items-center justify-center gap-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <ChevronLeft className="size-4" />
                    Geri
                  </button>
                ) : isExisting ? (
                  <button
                    onClick={() => setShowAddWizard(false)}
                    className="flex items-center justify-center gap-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <ChevronLeft className="size-4" />
                    Geri
                  </button>
                ) : null}

                {wizardStep < WIZARD_STEPS.length - 1 ? (
                  <button
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="flex-1 flex items-center justify-center gap-1 py-3 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    Devam
                    <ChevronRight className="size-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={!name.trim() || selectedListIds.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl text-sm hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ fontWeight: 600 }}
                  >
                    <Check className="size-4" />
                    Tamamla
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
