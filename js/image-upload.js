/* ========================================
   IMAGE-UPLOAD.JS — Client-side Image Compress
   & Supabase Storage Upload
   
   Plan limits:
   - Free:  before = 2, after = 1
   - Basic: before = 3, after = 2
   - Pro:   before = 5, after = 3
   ======================================== */

const ImageUpload = {

    /* ─── Plan Limits ────────────────────── */
    LIMITS: {
        free:  { before: 2, after: 1 },
        basic: { before: 3, after: 2 },
        pro:   { before: 5, after: 3 },
    },

    /* ─── Compression Settings ───────────── */
    MAX_WIDTH:   1280,   // px — resize jika lebih lebar
    MAX_HEIGHT:  1280,   // px — resize jika lebih tinggi
    QUALITY:     0.78,   // JPEG quality (78% = sweet spot)
    OUTPUT_TYPE: 'image/jpeg',

    /* ─── Get Limit untuk Current User ──── */
    getLimits() {
        const plan = Auth?.currentUser?.plan || 'free';
        return this.LIMITS[plan] || this.LIMITS.free;
    },

    /* ─── Client-side Compress via Canvas ── */
    async compress(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                let { width, height } = img;

                // Scale down jika terlalu besar
                if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
                    const ratio = Math.min(this.MAX_WIDTH / width, this.MAX_HEIGHT / height);
                    width  = Math.round(width  * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width  = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    if (!blob) { reject(new Error('Gagal compress gambar')); return; }
                    resolve(blob);
                }, this.OUTPUT_TYPE, this.QUALITY);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Gagal membaca file gambar'));
            };

            img.src = url;
        });
    },

    /* ─── Upload Satu File ke Supabase Storage ── */
    async uploadOne(file, journalId, type) {
        const uid = Auth?.currentUser?.id;
        if (!uid) throw new Error('User belum login');

        // Compress dulu
        const blob = await this.compress(file);

        // Buat path unik: {uid}/{journalId}/{type}_{timestamp}.jpg
        const ts   = Date.now();
        const path = `${uid}/${journalId}/${type}_${ts}.jpg`;

        const { data, error } = await window.DB.storage
            .from('journal-images')
            .upload(path, blob, {
                contentType: this.OUTPUT_TYPE,
                upsert: false,
            });

        if (error) throw error;

        // Dapatkan public URL
        const { data: urlData } = window.DB.storage
            .from('journal-images')
            .getPublicUrl(path);

        return {
            path: path,
            url:  urlData.publicUrl,
            type: type,     // 'before' | 'after'
        };
    },

    /* ─── Upload Array Files ─────────────── */
    async uploadMultiple(files, journalId, type) {
        const results = [];
        for (const file of files) {
            try {
                const result = await this.uploadOne(file, journalId, type);
                results.push(result);
            } catch (err) {
                console.error('[ImageUpload] Upload error:', err);
                App.showToast(`Gagal upload ${file.name}: ${err.message}`, 'error');
            }
        }
        return results;
    },

    /* ─── Hapus File dari Storage ────────── */
    async deleteImages(paths) {
        if (!paths || paths.length === 0) return;
        const { error } = await window.DB.storage
            .from('journal-images')
            .remove(paths);
        if (error) console.error('[ImageUpload] Delete error:', error);
    },

    /* ─── Render Preview Thumbnails ──────── */
    renderPreviews(files, container, type) {
        if (!container) return;
        // Hapus preview lama untuk type ini
        container.querySelectorAll(`[data-preview-type="${type}"]`).forEach(el => el.remove());

        Array.from(files).forEach((file, i) => {
            const url  = URL.createObjectURL(file);
            const wrap = document.createElement('div');
            wrap.className = 'img-preview-thumb';
            wrap.dataset.previewType = type;
            wrap.innerHTML = `
                <img src="${url}" alt="Preview ${i + 1}" onload="URL.revokeObjectURL(this.src)">
                <button class="img-preview-remove" data-index="${i}" data-type="${type}" type="button">×</button>
            `;
            container.appendChild(wrap);
        });
    },

    /* ─── File Input Handler ─────────────── */
    handleFileInput(input, type, previewContainer, fileArrayRef) {
        const limits = this.getLimits();
        const maxFiles = limits[type] || 2;
        const newFiles = Array.from(input.files || []);

        // Validasi jumlah
        const existing = fileArrayRef[type] || [];
        const total = existing.length + newFiles.length;
        if (total > maxFiles) {
            App.showToast(
                `Maksimal ${maxFiles} foto ${type === 'before' ? 'Setup' : 'Hasil'} ` +
                `(plan ${Auth?.currentUser?.plan || 'free'}).`,
                'error'
            );
            input.value = '';
            return false;
        }

        // Validasi tipe file
        const invalid = newFiles.filter(f => !f.type.startsWith('image/'));
        if (invalid.length > 0) {
            App.showToast('Hanya file gambar (JPG, PNG, WebP) yang diizinkan.', 'error');
            input.value = '';
            return false;
        }

        // Tambah ke array referensi
        fileArrayRef[type] = [...existing, ...newFiles];

        // Render preview semua file
        this.renderPreviews(fileArrayRef[type], previewContainer, type);

        // Reset input agar bisa pilih file lagi
        input.value = '';
        return true;
    },

    /* ─── Remove Preview ─────────────────── */
    removePreview(index, type, previewContainer, fileArrayRef) {
        fileArrayRef[type] = (fileArrayRef[type] || []).filter((_, i) => i !== index);
        this.renderPreviews(fileArrayRef[type], previewContainer, type);
    },

    /* ─── Format File Size ───────────────── */
    formatSize(bytes) {
        if (bytes < 1024)       return `${bytes} B`;
        if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    },
};
