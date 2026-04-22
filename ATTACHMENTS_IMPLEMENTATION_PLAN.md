# 📁 Внедрение системы вложений (Attachments & Avatars)

Реализация поддержки файлов затронет базу данных, бэкенд (Node.js) и фронтенд компоненты. Ниже представлен подробный инженерный план по интеграции этой системы.

## ☑️ Утвержденные настройки

> [!IMPORTANT]
> План составлен с учетом ваших правок:
> - **Лимиты загрузки:** Полностью сняты (без лимитов). Система сможет принимать файлы и фото любого размера.
> - **Права доступа:** Загружать файлы в тикеты, оборудование и базу знаний разрешено **только администраторам и инженерам**. Пользователи-viewer могут только скачивать/просматривать их. Пользователи могут беспрепятственно загружать только свои личные аватарки.

## 🛠️ Предлагаемые изменения (Proposed Changes)

---

### Backend Components

#### [MODIFY] `server/index.js`
- **Миграции Базы Данных (при запуске):**
  - Добавление `avatar_url TEXT` в таблицу `users`.
  - Добавление `attachments JSONB DEFAULT '[]'::jsonb` в `support_tickets`.
  - Добавление `attachments JSONB DEFAULT '[]'::jsonb` в `equipment`.
  - Добавление `attachments JSONB DEFAULT '[]'::jsonb` в `knowledge_base` и `instructions` (документация).
- **Хранилище (Multer):**
  - Обновление конфигурации `multer` на динамическую генерацию директорий (`uploads/avatars`, `uploads/tickets`, `uploads/equipment`, `uploads/kb`). 
  - Полное удаление объекта `limits: { fileSize }` из конфигурации для снятия ограничений на вес файла.
- **API Endpoints:**
  - `POST /api/upload/:directory` — универсальный защищенный эндпоинт для загрузки, возвращающий `{ url, originalName, size, mimeType }`. Защищен middleware проверки ролей: аватарки могут менять все, остальное — только admin/engineer.
  - `PATCH /api/users/:id/avatar`
  - `PATCH /api/tickets/:id/attachments`
  - `PATCH /api/equipment/:id/attachments`

---

### Frontend Components

#### [MODIFY] `types.ts`
- Добавление интерфейса `FileAttachment` и расширение сущностей `User`, `SupportTicket`, `Equipment`, `Instruction`, `KnowledgeBaseArticle` новыми полями для хранения вложений.

#### [NEW] `components/FileUploader.tsx`
- Умная зона Drag-and-Drop (накидывание файлов мышкой).
- Логика блокировки: кнопка или область вообще не будут показаны для роли `viewer`.
- Интеграция с UI (Glassmorphism, цвета Anthracite / Milky Cream).

#### [NEW] `components/AttachmentList.tsx`
- Рендеринг загруженных файлов: для картинок красивое превью (thumbnail), для документов — стилизованные плашки с иконками, размером файла и кнопкой скачивания.

#### [MODIFY] Внедрение во все экраны
- **`components/UserAvatar.tsx`**: отображение загруженной аватарки по ссылке.
- **`components/UserManager.tsx`**: кнопка загрузки аватарки в управлении профилем юзера.
- **`components/SupportTicketModal.tsx`**: секция "Материалы" для прикрепления логов и фото.
- **`components/SupportTicketManager.tsx`** (Kanban / Table): иконка 📎 (скрепки) на карточках с вложениями.
- **`components/EquipmentManager.tsx`**: Секция "Документация и фото" в карточке оборудования.

---

## 🧪 План тестирования (Verification Plan)
1. Со стороны инженера загрузить гигантский лог-файл и 4K-картинку в тикет, убедиться, что от бекэнда не приходит 413 Payload Too Large.
2. Со стороны "viewer" убедиться, что нельзя загрузить ничего, кроме своего аватара.
3. Скачать прикрепленный файл и убедиться, что он бинарно не повредился.
