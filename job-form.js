// ==================== JOB FORM - Credit System ====================

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let userData = null;
    let uploadedMedia = [];
    let selectedJobType = 1; // 1 = Basic, 2 = Premium
    let userCredits = 0;

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
        const cost = selectedJobType === 1 ? 1 : 2;
        document.getElementById('submit-cost').textContent = cost;
        document.getElementById('submit-btn').innerHTML = `🚀 Publikovat za ${cost} kredit${cost > 1 ? 'y' : ''}`;
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
            hint.textContent = 'JPG, PNG, MP4, max 10MB';
            input.accept = 'image/*,video/*';
        } else {
            label.textContent = 'Fotky (max 3)';
            icon.textContent = '📷';
            text.textContent = 'Klikněte nebo přetáhněte fotky';
            hint.textContent = 'JPG, PNG, max 2MB na fotku';
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
        const maxSizeImage = 2 * 1024 * 1024; // 2MB
        const maxSizeVideo = 10 * 1024 * 1024; // 10MB

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
                showError(`Soubor příliš velký (max ${isVideo ? '10MB' : '2MB'})`);
                continue;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedMedia.push({
                    data: e.target.result,
                    type: isVideo ? 'video' : 'image'
                });
                renderPreviews();
            };
            reader.readAsDataURL(file);
        }
    }

    function renderPreviews() {
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
                renderPreviews();
            });
        });
    }

    // ==================== ERROR HANDLING ====================
    function showError(message) {
        const errorEl = document.getElementById('form-error');
        errorEl.textContent = '❌ ' + message;
        errorEl.classList.add('active');
        setTimeout(() => errorEl.classList.remove('active'), 3000);
    }

    // ==================== FORM SUBMISSION ====================
    document.getElementById('job-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser || !userData) {
            showError('Nejste přihlášeni');
            return;
        }

        const cost = selectedJobType === 1 ? 1 : 2;
        if (userCredits < cost) {
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

        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Publikuji...';

        try {
            // Calculate expiration
            const now = Date.now();
            const daysValid = selectedJobType === 1 ? 30 : 60;
            const expiresAt = now + (daysValid * 24 * 60 * 60 * 1000);

            // Generate job ID
            const jobRef = firebase.database().ref('jobs').push();
            const jobId = jobRef.key;

            // Separate images and videos
            const images = uploadedMedia.filter(m => m.type === 'image').map(m => m.data);
            const videos = uploadedMedia.filter(m => m.type === 'video').map(m => m.data);

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
                images: images,
                videos: videos,
                companyId: currentUser.uid,
                companyName: userData.name || 'Firma',
                companyAvatar: userData.avatar || '🏢',
                createdAt: now,
                expiresAt: expiresAt,
                jobPlanType: selectedJobType,
                isPremium: selectedJobType === 2,
                views: 0,
                likes: 0,
                active: true
            };

            // Save job
            await jobRef.set(jobData);

            // Deduct credits
            const newCredits = userCredits - cost;
            await firebase.database().ref(`users/${currentUser.uid}/credits`).set(newCredits);

            // Store media in localStorage
            if (uploadedMedia.length > 0) {
                const storedImages = JSON.parse(localStorage.getItem('jobImages') || '{}');
                storedImages[jobId] = images;
                localStorage.setItem('jobImages', JSON.stringify(storedImages));
            }

            // Show success
            document.getElementById('job-form-container').classList.add('hidden');
            document.getElementById('credit-stripe').classList.add('hidden');
            document.getElementById('success-message').classList.add('active');
            document.getElementById('view-job-link').href = `job-detail.html?id=${jobId}`;

            const daysText = selectedJobType === 1 ? '30' : '60';
            document.getElementById('success-text').textContent =
                `Vaše nabídka je viditelná ${daysText} dní. Zbývá ${newCredits} kreditů.`;

        } catch (error) {
            console.error('Error creating job:', error);
            showError('Chyba při publikování inzerátu');
            submitBtn.disabled = false;
            updateSubmitButton();
        }
    });
});
