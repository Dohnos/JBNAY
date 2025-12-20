// ==================== JOB FORM - Credit System ====================

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let userData = null;
    let uploadedMedia = []; // For previews
    let fileObjects = [];   // For actual File objects to upload
    let selectedJobType = 1; // 1 = Basic, 2 = Premium
    let userCredits = 0;

    // Edit mode
    let editMode = false;
    let editingJobId = null;
    let existingMedia = []; // To keep track of old images when editing
    let existingVideos = [];


    // Cropper instance
    let cropper = null;
    let currentCroppingFile = null;
    let currentCroppingIndex = -1;


    // ==================== CLOUDINARY CONFIG ====================
    // ⚠️ REPLACE THESE WITH YOUR ACTUAL VALUES
    const CLOUDINARY_CLOUD_NAME = 'drrzl7evt';
    const CLOUDINARY_UPLOAD_PRESET = 'jobtik_preset';


    // ==================== AUTH CHECK ====================
    firebase.auth().onAuthStateChanged(async (user) => {
        currentUser = user;

        if (user) {
            const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
            userData = snapshot.val();

            if (userData && userData.type === 'company') {
                if (userData.approved) {
                    document.getElementById('auth-required').classList.add('hidden');
                    document.getElementById('job-form-container').classList.remove('hidden');
                    document.getElementById('credit-stripe').classList.remove('hidden');

                    // Load credits
                    userCredits = userData.credits || 0;
                    updateCreditDisplay();
                    updateFormState();

                    // Check for edit mode
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.has('edit')) {
                        editingJobId = urlParams.get('edit');
                        loadJobForEdit(editingJobId);
                    }
                } else {

                    document.getElementById('auth-required').innerHTML = `
                        <div class="auth-required-icon">⏳</div>
                        <h3>Čekáte na schválení</h3>
                        <p>Váš firemní účet ještě nebyl schválen administrátorem.</p>
                        <a href="index.html" class="success-link primary">Zpět na hlavní stránku</a>
                    `;
                }
            } else {
                document.getElementById('auth-required').innerHTML = `
                    <div class="auth-required-icon">🚫</div>
                    <h3>Pouze pro firmy</h3>
                    <p>Váš účet je registrován jako uživatel. Pro přidávání inzerátů potřebujete firemní účet.</p>
                    <a href="index.html" class="success-link primary">Zpět na hlavní stránku</a>
                `;
            }
        }
    });

    function updateCreditDisplay() {
        document.getElementById('credit-count').textContent = userCredits;
    }

    function updateFormState() {
        const noCreditsWarning = document.getElementById('no-credits-warning');
        const typeSelection = document.getElementById('job-type-selection');
        const submitBtn = document.getElementById('submit-btn');

        if (userCredits < 1) {
            noCreditsWarning.classList.remove('hidden');
            typeSelection.style.opacity = '0.5';
            typeSelection.style.pointerEvents = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = '⚠️ Nedostatek kreditů';
        } else {
            noCreditsWarning.classList.add('hidden');
            typeSelection.style.opacity = '1';
            typeSelection.style.pointerEvents = 'auto';
            submitBtn.disabled = false;
            updateSubmitButton();
        }

        // Check if Type 2 is available
        const type2Card = document.querySelector('[data-type="2"]');
        if (userCredits < 2) {
            type2Card.classList.add('disabled');
        } else {
            type2Card.classList.remove('disabled');
        }
    }

    function updateSubmitButton() {
        if (editMode) return; // Don't update cost/text in edit mode
        const cost = selectedJobType === 1 ? 1 : 2;
        const submitCostEl = document.getElementById('submit-cost');
        if (submitCostEl) submitCostEl.textContent = cost;
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn && submitBtn.querySelector('#submit-cost')) {
            submitBtn.innerHTML = `🚀 Publikovat za ${cost} kredit${cost > 1 ? 'y' : ''}`;
        }
    }


    // ==================== JOB TYPE SELECTION ====================
    document.querySelectorAll('.job-type-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = parseInt(card.dataset.type);
            const cost = parseInt(card.dataset.cost);

            if (userCredits < cost) {
                showError(`Pro tento typ potřebujete ${cost} kredity`);
                return;
            }

            selectedJobType = type;

            document.querySelectorAll('.job-type-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            updateSubmitButton();
            updateMediaUpload();
        });
    });

    function updateMediaUpload() {
        const label = document.getElementById('media-label');
        const icon = document.getElementById('upload-icon');
        const text = document.getElementById('upload-text');
        const hint = document.getElementById('upload-hint');
        const input = document.getElementById('media-input');

        if (selectedJobType === 2) {
            label.textContent = 'Fotky nebo video (max 3)';
            icon.textContent = '🎬';
            text.textContent = 'Klikněte pro foto/video';
            hint.textContent = 'JPG, PNG (10MB), MP4 (50MB)';
            input.accept = 'image/*,video/*';
        } else {
            label.textContent = 'Fotky (max 3)';
            icon.textContent = '📷';
            text.textContent = 'Klikněte nebo přetáhněte fotky';
            hint.textContent = 'JPG, PNG, max 10MB na fotku';
            input.accept = 'image/*';
        }
    }

    // ==================== ORDER CREDITS MODAL ====================
    document.getElementById('order-credits-btn')?.addEventListener('click', () => {
        document.getElementById('order-credits-modal').classList.add('active');
    });

    document.getElementById('order-modal-close')?.addEventListener('click', () => {
        document.getElementById('order-credits-modal').classList.remove('active');
    });

    document.getElementById('order-credits-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'order-credits-modal') {
            document.getElementById('order-credits-modal').classList.remove('active');
        }
    });

    document.getElementById('submit-order-btn')?.addEventListener('click', async () => {
        if (!currentUser || !userData) return;

        const amount = parseInt(document.getElementById('credit-amount').value);
        const price = amount * 500;

        try {
            // Save order to Firebase
            await firebase.database().ref('creditOrders').push().set({
                companyId: currentUser.uid,
                companyName: userData.name,
                companyEmail: currentUser.email,
                amount: amount,
                price: price,
                status: 'pending',
                createdAt: Date.now()
            });

            document.getElementById('order-credits-modal').classList.remove('active');
            alert(`✅ Objednávka odeslána!\n\n${amount} kreditů za ${price.toLocaleString()} Kč\n\nAdmin vás bude brzy kontaktovat.`);
        } catch (error) {
            console.error('Error creating order:', error);
            alert('❌ Chyba při odesílání objednávky');
        }
    });

    // ==================== MEDIA UPLOAD ====================
    const uploadArea = document.getElementById('media-upload');
    const mediaInput = document.getElementById('media-input');
    const previewContainer = document.getElementById('media-previews');

    uploadArea?.addEventListener('click', () => mediaInput?.click());

    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    mediaInput?.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        const maxFiles = 3;
        const maxSizeImage = 10 * 1024 * 1024; // 10MB (Cloudinary handles large files well)
        const maxSizeVideo = 50 * 1024 * 1024; // 50MB

        for (const file of files) {
            if (uploadedMedia.length >= maxFiles) {
                showError('Maximálně 3 soubory');
                break;
            }

            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');

            if (!isImage && !isVideo) {
                showError('Pouze obrázky a videa');
                continue;
            }

            if (isVideo && selectedJobType !== 2) {
                showError('Video je dostupné pouze pro Premium typ');
                continue;
            }

            const maxSize = isVideo ? maxSizeVideo : maxSizeImage;
            if (file.size > maxSize) {
                showError(`Soubor příliš velký (max ${isVideo ? '50MB' : '10MB'})`);
                continue;
            }

            // Create preview or open cropper for images
            if (isImage) {
                openCropper(file);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedMedia.push({
                        data: e.target.result,
                        type: 'video'
                    });
                    fileObjects.push(file);
                    renderPreviews();
                };
                reader.readAsDataURL(file);
            }
        }
    }

    function renderPreviews() {
        const previewContainer = document.getElementById('media-previews');
        previewContainer.innerHTML = uploadedMedia.map((media, index) => `
            <div class="media-preview">
                ${media.type === 'video'
                ? `<video src="${media.data}" muted></video>`
                : `<img src="${media.data}" alt="Preview ${index + 1}">`}
                <button type="button" class="media-remove" data-index="${index}">✕</button>
            </div>
        `).join('');

        previewContainer.querySelectorAll('.media-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                uploadedMedia.splice(index, 1);
                fileObjects.splice(index, 1);
                renderPreviews();
            });
        });
    }

    // ==================== CROPPER LOGIC ====================

    function openCropper(file) {
        currentCroppingFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const cropperImage = document.getElementById('cropper-image');
            cropperImage.src = e.target.result;
            document.getElementById('cropper-modal').classList.add('active');

            if (cropper) cropper.destroy();

            cropper = new Cropper(cropperImage, {
                aspectRatio: 9 / 16,
                viewMode: 1,
                autoCropArea: 1,
                dragMode: 'move',
                responsive: true
            });
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('cropper-close')?.addEventListener('click', closeCropper);
    document.getElementById('cropper-cancel')?.addEventListener('click', closeCropper);

    function closeCropper() {
        document.getElementById('cropper-modal').classList.remove('active');
        if (cropper) cropper.destroy();
        cropper = null;
        currentCroppingFile = null;
    }

    document.getElementById('cropper-confirm')?.addEventListener('click', () => {
        if (!cropper) return;

        cropper.getCroppedCanvas({
            width: 800,
            height: 1422
        }).toBlob((blob) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedMedia.push({
                    data: e.target.result,
                    type: 'image'
                });

                // Convert blob back to file for consistency if needed, or store as blob
                const croppedFile = new File([blob], currentCroppingFile.name, { type: 'image/jpeg' });
                fileObjects.push(croppedFile);

                renderPreviews();
                closeCropper();
            };
            reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.85);
    });

    // ==================== LOCATION AUTOCOMPLETE ====================

    const locationInput = document.getElementById('job-location');
    const suggestionsList = document.getElementById('location-suggestions');
    let debounceTimer;

    locationInput?.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 3) {
            suggestionsList.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                // Using Nominatim API (OpenStreetMap)
                // limit=10 to find duplicates and then filter to 5
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=15&countrycodes=cz,sk&featuretype=settlement`);
                const data = await response.json();

                if (data.length > 0) {
                    renderSuggestions(data, query);
                } else {
                    suggestionsList.classList.add('hidden');
                }
            } catch (error) {
                console.error('Autocomplete error:', error);
            }
        }, 300);
    });


    function renderSuggestions(suggestions, query) {
        const uniqueCities = new Map();
        const lowQuery = query.toLowerCase();

        suggestions.forEach(s => {
            const city = s.address.city || s.address.town || s.address.village || s.address.municipality || s.display_name.split(',')[0];
            const country = s.address.country === 'Czechia' ? 'CZ' : (s.address.country === 'Slovakia' ? 'SK' : '');
            const key = `${city}|${country}`;

            if (!uniqueCities.has(key)) {
                uniqueCities.set(key, { city, country, label: `${city}${country ? ' (' + country + ')' : ''}` });
            }
        });

        // Convert to array and Sort: Prefix matches first
        const sorted = Array.from(uniqueCities.values()).sort((a, b) => {
            const aStarts = a.city.toLowerCase().startsWith(lowQuery);
            const bStarts = b.city.toLowerCase().startsWith(lowQuery);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.city.localeCompare(b.city);
        }).slice(0, 5);

        if (sorted.length === 0) {
            suggestionsList.classList.add('hidden');
            return;
        }

        suggestionsList.innerHTML = sorted.map(s =>
            `<div class="suggestion-item" data-value="${s.city}">${s.label}</div>`
        ).join('');


        suggestionsList.classList.remove('hidden');

        suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                locationInput.value = item.dataset.value;
                suggestionsList.classList.add('hidden');
            });
        });
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!locationInput?.contains(e.target) && !suggestionsList?.contains(e.target)) {
            suggestionsList?.classList.add('hidden');
        }
    });

    // ==================== AI GENERATOR ====================
    document.querySelectorAll('.ai-gen-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const jobTitle = document.getElementById('job-title').value || 'Pracovní pozice';
            const category = document.getElementById('job-category').value;

            let prompt = "";
            if (targetId === 'job-description') {
                prompt = `Napiš stručný a atraktivní popis pracovní pozice "${jobTitle}" v kategorii "${category}" pro TikTok generaci v češtině.`;
            } else if (targetId === 'job-requirements') {
                prompt = `Napiš 5 klíčových požadavků pro pozici "${jobTitle}".`;
            } else if (targetId === 'job-benefits') {
                prompt = `Napiš seznam atraktivních benefitů pro pozici "${jobTitle}".`;
            }

            const perplexityUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`;
            window.open(perplexityUrl, '_blank');
        });
    });


    // ==================== CLIENT SIDE RESIZE ====================
    function resizeImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Target TikTok ratio (9:16) - e.g. 800x1422
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 1422;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', 0.85); // 85% quality
                };
            };
        });
    }

    // ==================== CLOUDINARY UPLOAD ====================
    async function uploadToCloudinary(file) {
        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.secure_url; // URL of the uploaded asset (optimized by preset)
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw error;
        }
    }

    // ==================== ERROR HANDLING ====================
    function showError(message) {
        const errorEl = document.getElementById('form-error');
        errorEl.textContent = '❌ ' + message;
        errorEl.classList.add('active');
        setTimeout(() => errorEl.classList.remove('active'), 3000);
    }

    // ==================== EDIT MODE HELPERS ====================
    async function loadJobForEdit(id) {
        try {
            const snapshot = await firebase.database().ref(`jobs/${id}`).once('value');
            const job = snapshot.val();

            if (!job || (job.companyId !== currentUser.uid && job.userId !== currentUser.uid)) {
                showError('Tento inzerát nemůžete editovat.');
                return;
            }

            editMode = true;
            document.querySelector('.page-title').textContent = '✏️ Editovat inzerát';
            document.getElementById('submit-btn').textContent = '💾 Uložit změny';
            document.getElementById('credit-stripe').classList.add('hidden'); // No credit info in edit mode


            // Populate fields
            document.getElementById('job-title').value = job.title;
            document.getElementById('job-location').value = job.location;
            document.getElementById('job-category').value = job.category;
            document.getElementById('job-work-type').value = job.type || 'HPP';
            document.getElementById('job-salary-min').value = job.salaryMin || '';
            document.getElementById('job-salary-max').value = job.salaryMax || '';
            document.getElementById('job-description').value = job.description;
            document.getElementById('job-requirements').value = job.requirements || '';
            document.getElementById('job-benefits').value = job.benefits || '';

            selectedJobType = job.jobPlanType || 1;
            updateFormState();

            // Load existing media
            existingMedia = job.images || [];
            existingVideos = job.videos || [];

            // Map to uploadedMedia for preview
            uploadedMedia = [];
            existingMedia.forEach(url => {
                uploadedMedia.push({ data: url, type: 'image', existing: true });
            });
            existingVideos.forEach(url => {
                uploadedMedia.push({ data: url, type: 'video', existing: true });
            });

            renderPreviews();
        } catch (error) {
            console.error('Error loading job for edit:', error);
            showError('Nepodařilo se načíst data inzerátu.');
        }
    }

    // Update renderPreviews to handle existing vs new media removal
    function renderPreviews() {
        const previewContainer = document.getElementById('media-previews');
        previewContainer.innerHTML = uploadedMedia.map((media, index) => {
            const src = media.data;
            return `
                <div class="media-preview">
                    ${media.type === 'video'
                    ? `<video src="${src}" muted></video>`
                    : `<img src="${src}" alt="Preview ${index + 1}">`}
                    <button type="button" class="media-remove" data-index="${index}">✕</button>
                </div>
            `;
        }).join('');

        previewContainer.querySelectorAll('.media-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const removedItem = uploadedMedia[index];

                // If it was existing, we'll need to update existingMedia lists
                if (removedItem.existing) {
                    if (removedItem.type === 'image') {
                        existingMedia = existingMedia.filter(u => u !== removedItem.data);
                    } else {
                        existingVideos = existingVideos.filter(u => u !== removedItem.data);
                    }
                } else {
                    // It was a new file, find its index in fileObjects
                    // Since fileObjects only contains NEW files, we need to know how many existing items were before it
                    let newFileIndex = 0;
                    for (let i = 0; i < index; i++) {
                        if (!uploadedMedia[i].existing) newFileIndex++;
                    }
                    fileObjects.splice(newFileIndex, 1);
                }

                uploadedMedia.splice(index, 1);
                renderPreviews();
            });
        });
    }

    // ==================== FORM SUBMISSION ====================
    document.getElementById('job-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser || !userData) {
            showError('Nejste přihlášeni');
            return;
        }

        const cost = selectedJobType === 1 ? 1 : 2;
        if (!editMode && userCredits < cost) { // Only check credits if not in edit mode
            showError('Nedostatek kreditů');
            return;
        }

        const title = document.getElementById('job-title').value.trim();
        const location = document.getElementById('job-location').value.trim();
        const workType = document.getElementById('job-work-type').value;
        const category = document.getElementById('job-category').value;
        const description = document.getElementById('job-description').value.trim();
        const requirements = document.getElementById('job-requirements').value.trim();
        const benefits = document.getElementById('job-benefits').value.trim();
        const salaryMin = document.getElementById('job-salary-min').value;
        const salaryMax = document.getElementById('job-salary-max').value;

        if (!title || !location || !description) {
            showError('Vyplňte všechna povinná pole');
            return;
        }

        if (uploadedMedia.length === 0) {
            showError('Přidejte alespoň jeden obrázek');
            return;
        }

        // Disable button and show loading
        const submitBtn = document.getElementById('submit-btn');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Nahrávám média... (0/' + fileObjects.length + ')';

        // Upload media to Cloudinary
        const uploadedUrls = [];
        const uploadedVideoUrls = [];

        try {
            for (let i = 0; i < fileObjects.length; i++) {
                submitBtn.innerHTML = `⏳ Nahrávám média... (${i + 1}/${fileObjects.length})`;
                const file = fileObjects[i];
                const url = await uploadToCloudinary(file);

                if (file.type.startsWith('video/')) {
                    uploadedVideoUrls.push(url);
                } else {
                    uploadedUrls.push(url);
                }
            }
        } catch (uploadError) {
            console.error('Upload failed:', uploadError);
            showError('Chyba při nahrávání médií. Zkuste to prosím znovu.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }

        submitBtn.innerHTML = '🚀 Publikuji...';

        try {
            // Calculate expiration
            const now = Date.now();
            const daysValid = selectedJobType === 1 ? 30 : 60;
            const expiresAt = now + (daysValid * 24 * 60 * 60 * 1000);

            // Use existing or new ID
            const jobRef = editMode ? firebase.database().ref(`jobs/${editingJobId}`) : firebase.database().ref('jobs').push();
            const jobId = jobRef.key;

            const jobData = {
                id: jobId,
                title: title,
                location: location,
                type: workType,
                category: category,
                description: description,
                requirements: requirements,
                benefits: benefits,
                salaryMin: salaryMin ? parseInt(salaryMin) : null,
                salaryMax: salaryMax ? parseInt(salaryMax) : null,
                images: [...existingMedia, ...uploadedUrls],
                videos: [...existingVideos, ...uploadedVideoUrls],
                companyId: currentUser.uid,
                userId: currentUser.uid, // Backward compatibility
                companyName: userData.name || 'Firma',
                companyAvatar: userData.avatar || '🏢',

                jobPlanType: selectedJobType,
                isPremium: selectedJobType === 2,
                active: true
            };

            // For update, we want to NOT overwrite createdAt and expiresAt if they exist
            if (editMode) {
                await jobRef.update(jobData);
            } else {
                jobData.createdAt = now;
                jobData.expiresAt = expiresAt;
                jobData.views = 0;
                jobData.likes = 0;
                await jobRef.set(jobData);
            }


            // Deduct credits ONLY if not editing
            if (!editMode) {
                const newCredits = userCredits - selectedJobType;
                await firebase.database().ref('users/' + currentUser.uid).update({
                    credits: newCredits
                });
            }
            // Show success
            document.getElementById('job-form-container').classList.add('hidden');
            document.getElementById('credit-stripe').classList.add('hidden');
            document.getElementById('success-message').classList.add('active');
            document.getElementById('view-job-link').href = `job-detail.html?id=${jobId}`;

            const daysText = selectedJobType === 1 ? '30' : '60';
            const msgText = editMode ? 'Změny byly uloženy.' : `Vaše nabídka je viditelná ${daysText} dní. Zbývá ${userCredits - selectedJobType} kreditů.`;
            document.getElementById('success-text').textContent = msgText;

        } catch (error) {
            console.error('Error creating job:', error);
            showError('Chyba při publikování inzerátu');
            const submitBtn = document.getElementById('submit-btn');
            submitBtn.disabled = false;
            updateSubmitButton();
        }
    });
});
