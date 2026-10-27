// Arka uç seçici: varsayılan gerçek Firebase. Yerel deneme için URL'ye ?mock=1 ekle (localStorage arka ucu).
// Firebase web yapılandırması tasarım gereği herkese açıktır; şifre ya da gizli anahtar DEĞİLDİR.
import type { Backend } from './types';
import { mockBackend } from './mock';
import { firebaseBackend } from './firebase';
const useMock = new URLSearchParams(location.search).has('mock');
export const backend: Backend = useMock ? mockBackend : firebaseBackend;
export * from './types';
