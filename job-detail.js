// ==================== JOB DETAIL - Detail nabídky ====================

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let userData = null;
    let currentJob = null;
    let jobId = null;
    const ADMIN_EMAIL = 'solidet@seznam.cz';

    function isAdmin() { return currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(); }
    function isCompany() { return userData?.type === 'company'; }

    // Get job ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    jobId = urlParams.get('id');

    if (!jobId) {
        showNotFound();
        return;
    }

    // ==================== TOAST ====================
    function showToast(message, duration = 2500) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(100px)';
        }, duration);
    }

    // ==================== AUTH ====================
    firebase.auth().onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
            userData = snapshot.val();
        }
        updateAuthUI();
    });

    function updateAuthUI() {
        const likeBtn = document.getElementById('like-btn');
        const applyBtn = document.getElementById('apply-btn');

        if (currentUser) {
            document.getElementById('login-prompt').classList.add('hidden');

            // Companies can't like or apply
            if (isCompany()) {
                if (likeBtn) likeBtn.style.display = 'none';
                if (applyBtn) {
                    applyBtn.textContent = '🏢 Váš inzerát';
                    applyBtn.disabled = true;
                }
                document.getElementById('comment-form').classList.remove('hidden');
            } else {
                document.getElementById('comment-form').classList.remove('hidden');
            }
            updateOwnerActions();
        } else {
            document.getElementById('login-prompt').classList.remove('hidden');
            document.getElementById('comment-form').classList.add('hidden');
            document.getElementById('owner-actions')?.classList.add('hidden');
        }
    }

    function updateOwnerActions() {
        if (!currentUser || !currentJob) return;
        const ownerActions = document.getElementById('owner-actions');
        if (!ownerActions) return;

        const isOwner = currentJob.companyId === currentUser.uid || currentJob.userId === currentUser.uid;
        if (isOwner || isAdmin()) {
            ownerActions.classList.remove('hidden');
        } else {
            ownerActions.classList.add('hidden');
        }
    }

    // ==================== LOAD JOB ====================
    async function loadJob() {
        try {
            const snapshot = await firebase.database().ref('jobs/' + jobId).once('value');
            const job = snapshot.val();

            if (!job) {
                showNotFound();
                return;
            }

            currentJob = job;
            renderJob(job);
            incrementViews();
            loadComments();

        } catch (error) {
            console.error('Error loading job:', error);
            showNotFound();
        }
    }

    function showNotFound() {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('not-found').classList.remove('hidden');
    }

    function renderJob(job) {
        // Update page title
        document.title = `${job.title} | JobTik`;

        // Hide loading, show content
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('job-content').classList.remove('hidden');

        // Basic info
        document.getElementById('job-title').textContent = job.title;
        document.getElementById('job-category').textContent = getCategoryLabel(job.category);
        document.getElementById('company-name').textContent = job.companyName || 'Firma';
        document.getElementById('company-avatar').textContent = job.companyAvatar || '🏢';
        document.getElementById('job-location').textContent = '📍 ' + job.location;
        document.getElementById('views-count').textContent = job.views || 0;
        document.getElementById('likes-count').textContent = job.likes || 0;
        document.getElementById('job-description').textContent = job.description;

        // Requirements
        if (job.requirements) {
            document.getElementById('requirements-section').classList.remove('hidden');
            document.getElementById('job-requirements').textContent = job.requirements;
        }

        // Benefits
        if (job.benefits) {
            document.getElementById('benefits-section').classList.remove('hidden');
            document.getElementById('job-benefits').textContent = job.benefits;
        }

        // Meta tags
        const metaContainer = document.getElementById('job-meta');
        let metaHtml = `<span class="job-tag">${getTypeLabel(job.type)}</span>`;
        if (job.salaryMin || job.salaryMax) {
            const salary = formatSalary(job.salaryMin, job.salaryMax);
            metaHtml += `<span class="job-tag salary">💰 ${salary}</span>`;
        }
        metaContainer.innerHTML = metaHtml;

        // Gallery & Video
        renderGallery(job.images || [], job.videos || []);

        // Check if already liked
        checkIfLiked();

        // Render Expiry Badge
        const expiryContainer = document.getElementById('expiry-badge-container');
        if (expiryContainer && job.expiresAt) {
            const now = Date.now();
            const diffMs = job.expiresAt - now;
            const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            const isExpiringSoon = daysLeft <= 7;

            let expiryText = '';
            if (daysLeft > 1) expiryText = `${daysLeft} dní`;
            else if (daysLeft === 1) expiryText = `Poslední den`;
            else expiryText = `Dnes končí`;

            expiryContainer.innerHTML = `
                <div class="job-expiry-badge ${isExpiringSoon ? 'expiring-soon' : ''}" style="margin-left: 10px; height: 100%; align-self: stretch;">
                    <svg viewBox="0 0 24 24" fill="none" style="width: 18px; height: 18px;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <div style="display: flex; flex-direction: column; line-height: 1;">
                        <span style="font-size: 0.9rem; font-weight: 800;">${expiryText}</span>
                        <span style="font-size: 0.6rem; text-transform: uppercase;">Do smazání</span>
                    </div>
                </div>
            `;
        }

        // Finalize UI for author
        updateOwnerActions();
    }

    // ==================== OWNER ACTIONS ====================
    document.getElementById('edit-job-btn')?.addEventListener('click', () => {
        if (!jobId) return;
        window.location.href = `job-form.html?edit=${jobId}`;
    });

    document.getElementById('delete-job-btn')?.addEventListener('click', async () => {
        if (!confirm('Opravdu chcete tento inzerát smazat?')) return;

        try {
            await firebase.database().ref(`jobs/${jobId}`).remove();
            showToast('🗑️ Inzerát smazán');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            console.error('Error deleting job:', error);
            showToast('❌ Chyba při mazání');
        }
    });

    function getCategoryLabel(category) {
        const labels = {
            'it': 'IT / Vývoj',
            'marketing': 'Marketing',
            'sales': 'Obchod',
            'design': 'Design',
            'finance': 'Finance',
            'hr': 'HR',
            'gastro': 'Gastronomie',
            'retail': 'Retail',
            'other': 'Ostatní'
        };
        return labels[category] || category;
    }

    function getTypeLabel(type) {
        const labels = {
            'full-time': 'Plný úvazek',
            'part-time': 'Částečný úvazek',
            'contract': 'DPP/DPČ',
            'internship': 'Stáž',
            'remote': 'Remote'
        };
        return labels[type] || type;
    }

    function formatSalary(min, max) {
        if (min && max) {
            return `${min.toLocaleString()} - ${max.toLocaleString()} Kč`;
        } else if (min) {
            return `od ${min.toLocaleString()} Kč`;
        } else if (max) {
            return `do ${max.toLocaleString()} Kč`;
        }
        return '';
    }

    function renderGallery(images, videos = []) {
        const container = document.getElementById('job-gallery');

        const allMedia = [
            ...videos.map(v => ({ type: 'video', url: v })),
            ...(images || []).map(i => ({ type: 'image', url: i }))
        ];

        if (allMedia.length === 0) {
            // Check localStorage for images (backwards compatibility)
            const storedImages = JSON.parse(localStorage.getItem('jobImages') || '{}');
            if (storedImages[jobId] && storedImages[jobId].length > 0) {
                storedImages[jobId].forEach(url => allMedia.push({ type: 'image', url }));
            } else {
                return; // Keep default no-image state
            }
        }

        let currentIndex = 0;

        function updateGallery() {
            const total = allMedia.length;
            const current = allMedia[currentIndex];

            // Generate HTML
            let html = '';
            if (current.type === 'video') {
                html = `<video src="${current.url}" autoplay loop playsinline class="gallery-video"></video>`;
            } else {
                html = `<img src="${current.url}" alt="Job image ${currentIndex + 1}" class="gallery-image" id="gallery-img">`;
            }

            if (total > 1) {
                html += `
                    <div class="gallery-nav gallery-prev" id="gallery-prev">❮</div>
                    <div class="gallery-nav gallery-next" id="gallery-next">❯</div>
                    <div class="gallery-counter">${currentIndex + 1} / ${total}</div>
                `;
            }

            container.innerHTML = html;

            // Add event listeners if multiple images
            if (total > 1) {
                document.getElementById('gallery-prev').addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentIndex = (currentIndex - 1 + total) % total;
                    updateGallery();
                });

                document.getElementById('gallery-next').addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentIndex = (currentIndex + 1) % total;
                    updateGallery();
                });

                // Swipe support
                let touchStartX = 0;
                let touchEndX = 0;

                const img = document.getElementById('gallery-img');
                img.addEventListener('touchstart', e => {
                    touchStartX = e.changedTouches[0].screenX;
                });

                img.addEventListener('touchend', e => {
                    touchEndX = e.changedTouches[0].screenX;
                    handleSwipe();
                });

                function handleSwipe() {
                    const threshold = 50;
                    if (touchEndX < touchStartX - threshold) {
                        // Swiped Left -> Next
                        currentIndex = (currentIndex + 1) % total;
                        updateGallery();
                    }
                    if (touchEndX > touchStartX + threshold) {
                        // Swiped Right -> Prev
                        currentIndex = (currentIndex - 1 + total) % total;
                        updateGallery();
                    }
                }
            }
        }

        // Initialize
        updateGallery();
    }

    // ==================== VIEW COUNTER ====================
    async function incrementViews() {
        // Always increment on detail page load (unique per session)
        const viewKey = `viewed_detail_${jobId}_${Date.now().toString().slice(0, -4)}`;
        const hasViewed = sessionStorage.getItem(viewKey);

        if (!hasViewed) {
            try {
                await firebase.database().ref(`jobs/${jobId}/views`).transaction(views => (views || 0) + 1);
                sessionStorage.setItem(viewKey, '1');

                // Update UI
                const currentViews = parseInt(document.getElementById('views-count').textContent) || 0;
                document.getElementById('views-count').textContent = currentViews + 1;
            } catch (error) {
                console.error('Error incrementing views:', error);
            }
        }
    }

    // ==================== LIKE / FAVORITE ====================
    async function checkIfLiked() {
        if (!currentUser) return;

        try {
            const snapshot = await firebase.database().ref(`users/${currentUser.uid}/favorites/${jobId}`).once('value');
            if (snapshot.exists()) {
                document.getElementById('like-btn').classList.add('liked');
                document.getElementById('like-btn').textContent = '❤️ Oblíbeno';
            }
        } catch (error) {
            console.error('Error checking like:', error);
        }
    }

    document.getElementById('like-btn')?.addEventListener('click', async () => {
        if (!currentUser) {
            showToast('⚠️ Pro přidání do oblíbených se přihlaste');
            return;
        }

        if (isCompany()) {
            showToast('⚠️ Firmy nemohou přidávat do oblíbených');
            return;
        }

        const btn = document.getElementById('like-btn');
        const isLiked = btn.classList.contains('liked');

        try {
            if (isLiked) {
                // Remove from favorites
                await firebase.database().ref(`users/${currentUser.uid}/favorites/${jobId}`).remove();
                await firebase.database().ref(`jobs/${jobId}/likes`).transaction(likes => Math.max((likes || 1) - 1, 0));
                btn.classList.remove('liked');
                btn.textContent = '❤️ Oblíbené';
                showToast('💔 Odebráno z oblíbených');
            } else {
                // Add to favorites
                await firebase.database().ref(`users/${currentUser.uid}/favorites/${jobId}`).set({
                    title: currentJob.title,
                    company: currentJob.companyName,
                    location: currentJob.location,
                    addedAt: Date.now()
                });
                await firebase.database().ref(`jobs/${jobId}/likes`).transaction(likes => (likes || 0) + 1);
                btn.classList.add('liked');
                btn.textContent = '❤️ Oblíbeno';
                showToast('❤️ Přidáno do oblíbených!');
            }

            // Update likes count
            const snapshot = await firebase.database().ref(`jobs/${jobId}/likes`).once('value');
            document.getElementById('likes-count').textContent = snapshot.val() || 0;

        } catch (error) {
            console.error('Error toggling like:', error);
            showToast('❌ Chyba');
        }
    });

    // ==================== SHARE ====================
    document.getElementById('share-btn').addEventListener('click', async () => {
        const url = window.location.href;
        const title = currentJob ? currentJob.title : 'JobTik nabídka';

        if (navigator.share) {
            try {
                await navigator.share({ title, url });
            } catch (e) { }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                showToast('📋 Odkaz zkopírován!');
            } catch (e) {
                showToast('❌ Nelze zkopírovat');
            }
        }
    });

    document.getElementById('apply-btn')?.addEventListener('click', async () => {
        if (!currentUser) {
            showToast('⚠️ Pro přihlášení k nabídce se přihlaste');
            return;
        }

        if (isCompany()) {
            showToast('⚠️ Firmy se nemohou přihlašovat k nabídkám');
            return;
        }

        if (!currentJob) return;

        try {
            // Check if conversation exists
            const existingConv = await firebase.database().ref('conversations')
                .orderByChild(`participants/${currentUser.uid}`)
                .equalTo(true)
                .once('value');

            let conversationId = null;
            const conversations = existingConv.val() || {};

            for (const [id, conv] of Object.entries(conversations)) {
                if (conv.jobId === jobId) {
                    conversationId = id;
                    break;
                }
            }

            if (!conversationId) {
                // Create new conversation
                const newConvRef = firebase.database().ref('conversations').push();
                conversationId = newConvRef.key;

                await newConvRef.set({
                    jobId: jobId,
                    jobTitle: currentJob.title,
                    participants: {
                        [currentUser.uid]: true,
                        [currentJob.companyId]: true
                    },
                    participantNames: {
                        [currentUser.uid]: currentUser.displayName || 'Zájemce',
                        [currentJob.companyId]: currentJob.companyName
                    },
                    createdAt: Date.now(),
                    lastMessage: `Zájem o: ${currentJob.title}`,
                    lastMessageTime: Date.now()
                });

                // Send initial message
                await firebase.database().ref(`messages/${conversationId}`).push().set({
                    text: `Dobrý den, mám zájem o pozici: ${currentJob.title}`,
                    senderId: currentUser.uid,
                    senderName: currentUser.displayName || 'Zájemce',
                    timestamp: Date.now()
                });
            }

            const btn = document.getElementById('apply-btn');
            btn.textContent = '✅ Odesláno';
            btn.disabled = true;
            showToast('✅ Zájem odeslán! Zkontrolujte Inbox');

        } catch (error) {
            console.error('Error applying:', error);
            showToast('❌ Chyba při odesílání');
        }
    });

    // ==================== COMMENTS ====================
    function loadComments() {
        firebase.database().ref(`comments/${jobId}`)
            .orderByChild('timestamp')
            .on('value', (snapshot) => {
                const comments = snapshot.val() || {};
                const container = document.getElementById('comments-list');
                const count = Object.keys(comments).length;

                document.getElementById('comments-count').textContent = count;

                if (count === 0) {
                    container.innerHTML = '<div class="comments-empty">Zatím žádné komentáře. Buď první!</div>';
                    return;
                }

                container.innerHTML = Object.entries(comments)
                    .sort((a, b) => b[1].timestamp - a[1].timestamp)
                    .map(([id, comment]) => `
                        <div class="comment" data-id="${id}">
                            <div class="comment-header">
                                <span class="comment-author">${escapeHtml(comment.userName)}</span>
                                <div>
                                    <span class="comment-time">${formatTime(comment.timestamp)}</span>
                                    ${comment.userId === currentUser?.uid ? `<button class="comment-delete" data-id="${id}">🗑️</button>` : ''}
                                </div>
                            </div>
                            <div class="comment-text">${escapeHtml(comment.text)}</div>
                        </div>
                    `).join('');

                // Add delete listeners
                container.querySelectorAll('.comment-delete').forEach(btn => {
                    btn.addEventListener('click', () => deleteComment(btn.dataset.id));
                });
            });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'právě teď';
        if (diffMins < 60) return `před ${diffMins} min`;
        if (diffHours < 24) return `před ${diffHours} hod`;
        if (diffDays < 7) return `před ${diffDays} dny`;
        return date.toLocaleDateString('cs');
    }

    document.getElementById('comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) return;

        const input = document.getElementById('comment-input');
        const text = input.value.trim();

        if (!text) return;

        try {
            await firebase.database().ref(`comments/${jobId}`).push().set({
                text: text,
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Uživatel',
                timestamp: Date.now()
            });

            input.value = '';
            showToast('💬 Komentář přidán!');
        } catch (error) {
            console.error('Error adding comment:', error);
            showToast('❌ Chyba při přidávání komentáře');
        }
    });

    async function deleteComment(commentId) {
        if (!currentUser) return;

        try {
            await firebase.database().ref(`comments/${jobId}/${commentId}`).remove();
            showToast('🗑️ Komentář smazán');
        } catch (error) {
            console.error('Error deleting comment:', error);
            showToast('❌ Chyba');
        }
    }

    // ==================== INIT ====================
    loadJob();
});
