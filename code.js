// ==================== JOBTIK APP - Full Jobboard with Roles ====================

document.addEventListener("DOMContentLoaded", () => {

    // ==================== GLOBALS ====================
    let currentUser = null;
    let userData = null;
    let currentChatId = null;
    let currentCommentsJobId = null;
    let loadedJobs = [];

    // Admin email
    const ADMIN_EMAIL = 'solidet@seznam.cz';

    // ==================== TOAST NOTIFICATION ====================
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

    // ==================== ROLE HELPERS ====================
    function isAdmin() {
        return currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    }

    function isCompany() {
        return userData?.type === 'company';
    }

    function isUser() {
        return userData?.type === 'user';
    }

    function isCompanyApproved() {
        return userData?.approved === true;
    }

    // ==================== MODAL HELPERS ====================
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    document.getElementById('auth-close')?.addEventListener('click', () => closeModal('auth-modal'));
    document.getElementById('profile-close')?.addEventListener('click', () => closeModal('profile-modal'));
    document.getElementById('favorites-close')?.addEventListener('click', () => closeModal('favorites-modal'));
    document.getElementById('inbox-close')?.addEventListener('click', () => closeModal('inbox-modal'));
    document.getElementById('comments-close')?.addEventListener('click', () => closeModal('comments-modal'));
    document.getElementById('admin-close')?.addEventListener('click', () => closeModal('admin-modal'));
    document.getElementById('dashboard-close')?.addEventListener('click', () => closeModal('dashboard-modal'));


    // ==================== AUTH TABS ====================
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.getElementById(`${tabName}-form`)?.classList.add('active');
        });
    });

    // ==================== FIREBASE AUTH ====================
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            currentUser = user;

            if (user) {
                const snapshot = await firebase.database().ref('users/' + user.uid).once('value');
                userData = snapshot.val();

                updateUIForAuth(user);

                if (isUser()) {
                    loadFavorites(user.uid);
                }
                loadConversations(user.uid);
            } else {
                userData = null;
                updateUIForAuth(null);
            }
        });
    }

    function updateUIForAuth(user) {
        const addJobBtn = document.getElementById('add-job-btn');
        const jobsStat = document.getElementById('profile-jobs-stat');
        const typeBadge = document.getElementById('profile-type-badge');
        const favoritesNav = document.querySelector('[data-nav="favorites"]');
        const adminNav = document.getElementById('admin-nav');
        const createBtn = document.getElementById('create-btn');

        if (user && userData) {
            closeModal('auth-modal');

            document.getElementById('profile-name').textContent = userData.name || user.displayName || 'Uživatel';
            document.getElementById('profile-email').textContent = user.email;
            document.getElementById('profile-avatar').textContent = userData.avatar || (isCompany() ? '🏢' : '👤');

            // Admin UI
            if (isAdmin()) {
                adminNav?.classList.remove('hidden');
                typeBadge?.classList.remove('hidden');
                typeBadge.textContent = '👑 ADMIN';
                typeBadge.style.cssText = 'background: var(--color-accent); border: 2px solid #000; padding: 5px 15px; margin-top: 10px; font-weight: 700; text-transform: uppercase; font-size: 0.75rem;';
            } else {
                adminNav?.classList.add('hidden');
            }

            // Company UI
            if (isCompany()) {
                addJobBtn?.classList.remove('hidden');
                jobsStat?.classList.remove('hidden');
                favoritesNav?.classList.add('hidden'); // Companies can't have favorites

                // Show Dashboard button, hide Applications button
                document.getElementById('my-applications-btn')?.classList.add('hidden');
                document.getElementById('company-dashboard-btn')?.classList.remove('hidden');

                // Show credits in navbar

                const creditsNav = document.getElementById('credits-nav');
                const navCreditsCount = document.getElementById('nav-credits-count');
                if (isCompanyApproved()) {
                    creditsNav?.classList.remove('hidden');
                    navCreditsCount.textContent = userData.credits || 0;
                }

                if (!isAdmin()) {
                    typeBadge?.classList.remove('hidden');
                    if (isCompanyApproved()) {
                        typeBadge.textContent = '✅ Schválená firma';
                        typeBadge.style.cssText = 'background: var(--color-b2b); border: 2px solid #000; padding: 5px 15px; margin-top: 10px; font-weight: 700; text-transform: uppercase; font-size: 0.75rem;';
                        createBtn?.classList.remove('hidden');
                        document.getElementById('nav-dash-btn')?.classList.remove('hidden');
                    } else {
                        typeBadge.textContent = '⏳ Čeká na schválení';
                        typeBadge.style.cssText = 'background: var(--color-b2c); border: 2px solid #000; padding: 5px 15px; margin-top: 10px; font-weight: 700; text-transform: uppercase; font-size: 0.75rem;';
                        createBtn?.classList.add('hidden');
                        document.getElementById('nav-dash-btn')?.classList.add('hidden');
                    }
                }

                loadCompanyStats(user.uid);
            } else {
                // User UI
                addJobBtn?.classList.add('hidden');
                jobsStat?.classList.add('hidden');
                favoritesNav?.classList.remove('hidden');
                createBtn?.classList.add('hidden');
                document.getElementById('nav-dash-btn')?.classList.add('hidden');
                document.getElementById('credits-nav')?.classList.add('hidden');

                if (!isAdmin()) {
                    typeBadge?.classList.add('hidden');
                }
            }

            // Comments form
            document.getElementById('modal-login-prompt')?.classList.add('hidden');
            document.getElementById('modal-comment-form')?.classList.remove('hidden');
        } else {
            document.getElementById('modal-login-prompt')?.classList.remove('hidden');
            document.getElementById('modal-comment-form')?.classList.add('hidden');
            favoritesNav?.classList.remove('hidden');
            createBtn?.classList.add('hidden');
            document.getElementById('nav-dash-btn')?.classList.add('hidden');
            adminNav?.classList.add('hidden');
            document.getElementById('credits-nav')?.classList.add('hidden');
        }
    }

    async function loadCompanyStats(userId) {
        try {
            const snapshot = await firebase.database().ref('jobs').orderByChild('companyId').equalTo(userId).once('value');
            const jobs = snapshot.val() || {};
            const jobsList = Object.values(jobs);

            const totalJobs = jobsList.length;
            const totalViews = jobsList.reduce((sum, job) => sum + (job.views || 0), 0);
            const totalLikes = jobsList.reduce((sum, job) => sum + (job.likes || 0), 0);

            document.getElementById('profile-jobs-count').textContent = totalJobs;

            // Update company stats in profile
            const statsContainer = document.getElementById('company-stats');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="profile-stat">
                        <div class="profile-stat-value">${totalViews}</div>
                        <div class="profile-stat-label">Zhlédnutí</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-value">${totalLikes}</div>
                        <div class="profile-stat-label">Oblíbených</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading company stats:', error);
        }
    }

    // Register
    document.getElementById('register-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const userType = document.getElementById('register-type').value;
        const errorEl = document.getElementById('register-error');

        if (!name || !email || !password) {
            errorEl.textContent = '❌ Vyplňte všechna pole';
            errorEl.classList.add('active');
            return;
        }

        if (password.length < 6) {
            errorEl.textContent = '❌ Heslo musí mít min. 6 znaků';
            errorEl.classList.add('active');
            return;
        }

        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await user.updateProfile({ displayName: name });

            const isAdminEmail = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

            await firebase.database().ref('users/' + user.uid).set({
                name: name,
                email: email,
                type: userType,
                approved: userType === 'user' || isAdminEmail, // Users auto-approved, companies need approval
                isAdmin: isAdminEmail,
                createdAt: Date.now(),
                avatar: userType === 'company' ? '🏢' : '👤'
            });

            if (userType === 'company' && !isAdminEmail) {
                showToast('✅ Účet vytvořen! Čekejte na schválení adminem.');
            } else {
                showToast('✅ Účet vytvořen! Vítej, ' + name);
            }
            errorEl.classList.remove('active');

            // Auto reload after registration to refresh state
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('Registration error:', error);
            let message = '❌ Chyba při registraci';
            if (error.code === 'auth/email-already-in-use') message = '❌ Email již existuje';
            else if (error.code === 'auth/invalid-email') message = '❌ Neplatný email';
            errorEl.textContent = message;
            errorEl.classList.add('active');
        }
    });

    // Login
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        if (!email || !password) {
            errorEl.textContent = '❌ Vyplňte email a heslo';
            errorEl.classList.add('active');
            return;
        }

        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            showToast('✅ Přihlášení úspěšné!');
            errorEl.classList.remove('active');

            // Auto reload after login to refresh state
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            errorEl.textContent = '❌ Nesprávný email nebo heslo';
            errorEl.classList.add('active');
        }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try {
            await firebase.auth().signOut();
            showToast('👋 Odhlášeno');
            closeModal('profile-modal');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    document.getElementById('comments-login-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('comments-modal');
        openModal('auth-modal');
    });

    // ==================== ADMIN FUNCTIONS ====================
    async function loadPendingCompanies() {
        const container = document.getElementById('pending-companies');
        if (!container) return;

        try {
            const snapshot = await firebase.database().ref('users').orderByChild('type').equalTo('company').once('value');
            const users = snapshot.val() || {};

            const pending = Object.entries(users).filter(([id, user]) => !user.approved);

            if (pending.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">Žádné firmy ke schválení</p>';
                return;
            }

            container.innerHTML = pending.map(([id, user]) => `
                <div style="padding: 15px; border: 4px solid #000; margin-bottom: 10px; background: #fff;">
                    <div style="font-weight: 700; text-transform: uppercase;">${user.name}</div>
                    <div style="font-size: 0.85rem; color: #666;">${user.email}</div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button onclick="approveCompany('${id}')" style="padding: 8px 15px; background: var(--color-b2b); border: 3px solid #000; font-weight: 700; cursor: pointer;">✅ Schválit</button>
                        <button onclick="rejectCompany('${id}')" style="padding: 8px 15px; background: var(--color-b2c); border: 3px solid #000; font-weight: 700; cursor: pointer;">❌ Zamítnout</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading pending companies:', error);
        }
    }

    window.approveCompany = async function (userId) {
        if (!isAdmin()) return;
        try {
            await firebase.database().ref(`users/${userId}/approved`).set(true);
            showToast('✅ Firma schválena!');
            loadPendingCompanies();
        } catch (error) {
            console.error('Error approving company:', error);
        }
    };

    window.rejectCompany = async function (userId) {
        if (!isAdmin()) return;
        if (!confirm('Opravdu chcete zamítnout tuto firmu?')) return;
        try {
            await firebase.database().ref(`users/${userId}`).remove();
            showToast('❌ Firma zamítnuta a smazána');
            loadPendingCompanies();
        } catch (error) {
            console.error('Error rejecting company:', error);
        }
    };

    window.deleteJob = async function (jobId) {
        if (!isAdmin()) return;
        if (!confirm('Opravdu chcete smazat tento inzerát?')) return;
        try {
            await firebase.database().ref(`jobs/${jobId}`).remove();
            await firebase.database().ref(`comments/${jobId}`).remove();
            showToast('🗑️ Inzerát smazán');
            loadJobs();
        } catch (error) {
            console.error('Error deleting job:', error);
        }
    };

    // ==================== ADMIN CREDIT MANAGEMENT ====================
    async function loadCreditOrders() {
        const container = document.getElementById('credit-orders');
        if (!container) return;

        try {
            const snapshot = await firebase.database().ref('creditOrders').orderByChild('createdAt').once('value');
            const orders = snapshot.val() || {};
            const pendingOrders = Object.entries(orders).filter(([id, order]) => order.status === 'pending');

            if (pendingOrders.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 15px; color: #999;">Žádné čekající objednávky</p>';
                return;
            }

            container.innerHTML = pendingOrders.reverse().map(([id, order]) => `
                <div style="padding: 15px; border: 4px solid #000; margin-bottom: 10px; background: #fff;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-weight: 700; text-transform: uppercase;">${order.companyName}</div>
                            <div style="font-size: 0.85rem; color: #666;">${order.companyEmail}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; color: var(--color-accent);">${order.amount} kreditů</div>
                            <div style="font-size: 0.85rem;">${order.price.toLocaleString()} Kč</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button onclick="fulfillCreditOrder('${id}', '${order.companyId}', ${order.amount})" style="padding: 8px 15px; background: var(--color-b2b); border: 3px solid #000; font-weight: 700; cursor: pointer;">✅ Vyřídit</button>
                        <button onclick="rejectCreditOrder('${id}')" style="padding: 8px 15px; background: var(--color-b2c); border: 3px solid #000; font-weight: 700; cursor: pointer;">❌ Zamítnout</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading credit orders:', error);
        }
    }

    window.fulfillCreditOrder = async function (orderId, companyId, amount) {
        if (!isAdmin()) return;
        try {
            const userSnapshot = await firebase.database().ref(`users/${companyId}/credits`).once('value');
            const currentCredits = userSnapshot.val() || 0;
            await firebase.database().ref(`users/${companyId}/credits`).set(currentCredits + amount);
            await firebase.database().ref(`creditOrders/${orderId}/status`).set('fulfilled');
            showToast(`✅ ${amount} kreditů přiděleno!`);
            loadCreditOrders();
            loadAllCompanies();
        } catch (error) {
            console.error('Error fulfilling order:', error);
        }
    };

    window.rejectCreditOrder = async function (orderId) {
        if (!isAdmin()) return;
        if (!confirm('Opravdu chcete zamítnout tuto objednávku?')) return;
        try {
            await firebase.database().ref(`creditOrders/${orderId}/status`).set('rejected');
            showToast('❌ Objednávka zamítnuta');
            loadCreditOrders();
        } catch (error) {
            console.error('Error rejecting order:', error);
        }
    };

    async function loadAllCompanies() {
        const container = document.getElementById('all-companies-list');
        const select = document.getElementById('admin-company-select');
        if (!container) return;

        try {
            const snapshot = await firebase.database().ref('users').orderByChild('type').equalTo('company').once('value');
            const companies = snapshot.val() || {};
            const approved = Object.entries(companies).filter(([id, c]) => c.approved);

            // Update select dropdown
            if (select) {
                select.innerHTML = '<option value="">-- Vyberte firmu --</option>' +
                    approved.map(([id, c]) => `<option value="${id}">${c.name} (${c.credits || 0} kreditů)</option>`).join('');
            }

            if (approved.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 15px; color: #999;">Žádné schválené firmy</p>';
                return;
            }

            container.innerHTML = approved.map(([id, company]) => `
                <div style="padding: 12px; border: 3px solid #000; margin-bottom: 8px; background: #fff; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: 700;">${company.name}</span>
                        <span style="font-size: 0.85rem; color: #666; margin-left: 10px;">${company.email}</span>
                    </div>
                    <div style="background: var(--color-accent); padding: 5px 12px; border: 2px solid #000; font-weight: 700;">
                        💎 ${company.credits || 0}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading companies:', error);
        }
    }

    document.getElementById('admin-add-credits-btn')?.addEventListener('click', async () => {
        if (!isAdmin()) return;

        const select = document.getElementById('admin-company-select');
        const amountInput = document.getElementById('admin-credits-amount');
        const companyId = select?.value;
        const amount = parseInt(amountInput?.value) || 0;

        if (!companyId) {
            showToast('⚠️ Vyberte firmu');
            return;
        }
        if (amount < 1) {
            showToast('⚠️ Zadejte platný počet kreditů');
            return;
        }

        try {
            const userSnapshot = await firebase.database().ref(`users/${companyId}/credits`).once('value');
            const currentCredits = userSnapshot.val() || 0;
            await firebase.database().ref(`users/${companyId}/credits`).set(currentCredits + amount);
            showToast(`✅ ${amount} kreditů přidáno!`);
            loadAllCompanies();
            amountInput.value = '1';
            select.value = '';
        } catch (error) {
            console.error('Error adding credits:', error);
            showToast('❌ Chyba při přidávání kreditů');
        }
    });

    // ==================== LOAD JOBS FROM FIREBASE ====================
    async function loadJobs() {
        try {
            const snapshot = await firebase.database().ref('jobs').orderByChild('createdAt').once('value');
            const jobs = snapshot.val() || {};
            const now = Date.now();

            loadedJobs = Object.entries(jobs)
                .map(([id, job]) => ({ id, ...job }))
                .filter(job => job.active !== false && (!job.expiresAt || job.expiresAt > now))
                // Sort: Premium first, then by createdAt (newest first)
                .sort((a, b) => {
                    // Premium always on top
                    if (a.isPremium && !b.isPremium) return -1;
                    if (!a.isPremium && b.isPremium) return 1;
                    // Then sort by createdAt (newest first)
                    return (b.createdAt || 0) - (a.createdAt || 0);
                });

            renderJobs(loadedJobs);
            updateStats();
        } catch (error) {
            console.error('Error loading jobs:', error);
            document.getElementById('loading-slide').innerHTML = `
                <div style="text-align: center; color: #fff;">
                    <p style="font-family: var(--font-bold); text-transform: uppercase;">❌ Chyba při načítání</p>
                </div>
            `;
        }
    }

    function renderJobs(jobs) {
        const container = document.getElementById('job-feed');
        const loadingSlide = document.getElementById('loading-slide');
        if (loadingSlide) loadingSlide.remove();

        // Clear existing job slides but keep hero
        container.querySelectorAll('.slide').forEach(s => s.remove());

        if (jobs.length === 0) {
            container.innerHTML += `
                <div class="slide" style="display: flex; align-items: center; justify-content: center;">
                    <div style="text-align: center; color: #fff; padding: 40px;">
                        <div style="font-size: 4rem; margin-bottom: 20px;">📭</div>
                        <h2 style="font-family: var(--font-bold); text-transform: uppercase; margin-bottom: 10px;">Zatím žádné nabídky</h2>
                        <p style="opacity: 0.7;">Buďte první firma, která přidá inzerát!</p>
                    </div>
                </div>
            `;
            return;
        }

        jobs.forEach(job => {
            const slide = createJobSlide(job);
            container.appendChild(slide);
        });

        initializeViewObserver();
    }

    function createJobSlide(job) {
        const slide = document.createElement('div');
        slide.className = job.isPremium ? 'slide premium' : 'slide';
        slide.dataset.jobId = job.id;

        const storedImages = JSON.parse(localStorage.getItem('jobImages') || '{}');
        const images = job.images || [];
        const videos = job.videos || [];
        const hasVideo = videos.length > 0;

        let backgroundContent = '';
        if (hasVideo) {
            backgroundContent = `
                <video src="${videos[0]}" loop playsinline class="job-video-bg" poster="${images[0] || ''}"></video>
            `;
        } else {
            const bgImage = images[0] || '';
            const bgStyle = bgImage
                ? `background-image: url('${bgImage}');`
                : 'background: var(--bg-gradient);';
            backgroundContent = `<div class="job-bg-inner" style="${bgStyle}"></div>`;
        }

        const showFavoriteBtn = !isCompany();

        // Calculate expiration countdown
        const now = Date.now();
        const diffMs = job.expiresAt ? (job.expiresAt - now) : 0;
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const isExpiringSoon = daysLeft <= 7;

        let expiryText = '';
        if (daysLeft > 1) expiryText = `${daysLeft} dní`;
        else if (daysLeft === 1) expiryText = `Poslední den`;
        else expiryText = `Dnes končí`;

        slide.innerHTML = `
            <div class="job-bg-outer"></div>
            ${backgroundContent}
            <div class="job-bg-overlay"></div>
            <div class="overlay"></div>
            
            <div class="content-layer">
                <div class="top-bar">
                    <div class="badge-container">
                        <div class="badge b2c-badge">${getCategoryLabel(job.category)}</div>
                        <div class="badge">📍 ${job.location}</div>
                        ${daysLeft !== null ? `<div class="job-expiry-badge ${isExpiringSoon ? 'expiring-soon' : ''}"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> ${expiryText}</div>` : ''}
                    </div>
                    ${isAdmin() ? `<button onclick="deleteJob('${job.id}')" style="background: var(--color-b2c); border: 3px solid #000; padding: 5px 10px; font-weight: 700; cursor: pointer;">🗑️</button>` : ''}
                </div>
                
                <div class="actions-bar">
                    ${showFavoriteBtn ? `
                        <div class="action-btn" data-action="like" data-id="${job.id}">❤️</div>
                        <span class="action-label">${job.likes || 0}</span>
                    ` : ''}
                    <div class="action-btn" data-action="comment" data-id="${job.id}">💬</div>
                    <span class="action-label">${job.commentsCount || 0}</span>
                    <div class="action-btn" data-action="view" data-id="${job.id}">👁️</div>
                    <span class="action-label view-count" data-view-id="${job.id}">${job.views || 0}</span>
                    <div class="action-btn" data-action="share" data-id="${job.id}">📤</div>
                    <span class="action-label">Sdílet</span>
                </div>
                
                <div class="info-area-minimal">
                    <h2>${job.title}</h2>
                    <p>${job.description?.substring(0, 90)}${job.description?.length > 90 ? '...' : ''}</p>
                    <div class="cta-container-minimal">
                        <a href="job-detail.html?id=${job.id}" class="cta-btn-minimal cta-primary">DETAIL</a>
                        ${!isCompany() ? `<button class="cta-btn-minimal cta-secondary apply-btn" data-job-id="${job.id}">MÁM ZÁJEM</button>` : ''}
                    </div>
                </div>
            </div>
        `;

        addSlideEventListeners(slide, job);
        return slide;
    }

    function getCategoryLabel(category) {
        const labels = {
            'it': 'IT / Vývoj', 'marketing': 'Marketing', 'sales': 'Obchod',
            'design': 'Design', 'finance': 'Finance', 'hr': 'HR',
            'gastro': 'Gastronomie', 'retail': 'Retail', 'other': 'Ostatní'
        };
        return labels[category] || category || 'Práce';
    }

    function addSlideEventListeners(slide, job) {
        slide.querySelector('[data-action="like"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (isCompany()) {
                showToast('⚠️ Firmy nemohou přidávat do oblíbených');
                return;
            }
            await toggleLike(job.id, job, e.currentTarget);
        });

        slide.querySelector('[data-action="comment"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openCommentsModal(job.id, job.companyId);
        });

        slide.querySelector('[data-action="share"]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await shareJob(job);
        });

        slide.querySelector('.apply-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isCompany()) {
                showToast('⚠️ Firmy se nemohou přihlašovat k nabídkám');
                return;
            }
            await applyToJob(job, e.currentTarget);
        });
    }

    // ==================== VIEW COUNTER ====================
    function initializeViewObserver() {
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.6 };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(async entry => {
                const video = entry.target.querySelector('.job-video-bg');

                if (entry.isIntersecting) {
                    const jobId = entry.target.dataset.jobId;
                    if (jobId) {
                        await incrementView(jobId);
                    }
                    if (video) video.play().catch(e => console.log("Autoplay blocked", e));
                } else {
                    if (video) video.pause();
                }
            });
        }, observerOptions);

        document.querySelectorAll('.slide[data-job-id]').forEach(slide => observer.observe(slide));
    }

    async function incrementView(jobId) {
        const viewKey = `viewed_${jobId}_${Date.now().toString().slice(0, -4)}`; // Unique per ~10 seconds
        const hasViewed = sessionStorage.getItem(viewKey);

        if (hasViewed) return;

        try {
            await firebase.database().ref(`jobs/${jobId}/views`).transaction(views => (views || 0) + 1);
            sessionStorage.setItem(viewKey, '1');

            // Update UI
            const label = document.querySelector(`[data-view-id="${jobId}"]`);
            if (label) {
                const current = parseInt(label.textContent) || 0;
                label.textContent = current + 1;
            }
        } catch (error) {
            console.error('Error incrementing view:', error);
        }
    }

    async function updateStats() {
        try {
            const jobsSnapshot = await firebase.database().ref('jobs').once('value');
            const jobsCount = Object.keys(jobsSnapshot.val() || {}).length;
            document.getElementById('stat-jobs').textContent = jobsCount;

            const usersSnapshot = await firebase.database().ref('users').once('value');
            const users = usersSnapshot.val() || {};
            const usersCount = Object.keys(users).length;
            const companiesCount = Object.values(users).filter(u => u.type === 'company' && u.approved).length;

            document.getElementById('stat-companies').textContent = companiesCount;
            document.getElementById('stat-users').textContent = usersCount;
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // ==================== LIKE / FAVORITE ====================
    async function toggleLike(jobId, job, btn) {
        if (!currentUser) {
            showToast('⚠️ Pro přidání do oblíbených se přihlaste');
            openModal('auth-modal');
            return;
        }

        if (isCompany()) {
            showToast('⚠️ Firmy nemohou přidávat do oblíbených');
            return;
        }

        const isLiked = btn.classList.contains('liked');

        try {
            if (isLiked) {
                await firebase.database().ref(`users/${currentUser.uid}/favorites/${jobId}`).remove();
                await firebase.database().ref(`jobs/${jobId}/likes`).transaction(likes => Math.max((likes || 1) - 1, 0));
                btn.classList.remove('liked');
                showToast('💔 Odebráno z oblíbených');
            } else {
                await firebase.database().ref(`users/${currentUser.uid}/favorites/${jobId}`).set({
                    title: job.title,
                    company: job.companyName,
                    location: job.location,
                    addedAt: Date.now()
                });
                await firebase.database().ref(`jobs/${jobId}/likes`).transaction(likes => (likes || 0) + 1);
                btn.classList.add('liked');
                showToast('❤️ Přidáno do oblíbených!');
            }

            const snapshot = await firebase.database().ref(`jobs/${jobId}/likes`).once('value');
            const label = btn.nextElementSibling;
            if (label) label.textContent = snapshot.val() || 0;

            loadFavorites(currentUser.uid);
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }

    // ==================== SHARE ====================
    async function shareJob(job) {
        const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}job-detail.html?id=${job.id}`;

        if (navigator.share) {
            try { await navigator.share({ title: job.title, text: `Podívej se: ${job.title}`, url }); } catch (e) { }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                showToast('📋 Odkaz zkopírován!');
            } catch (e) { }
        }
    }

    // ==================== APPLY TO JOB ====================
    async function applyToJob(job, btn) {
        if (!currentUser) {
            showToast('⚠️ Pro přihlášení se přihlaste');
            openModal('auth-modal');
            return;
        }

        if (isCompany()) {
            showToast('⚠️ Firmy se nemohou přihlašovat');
            return;
        }

        try {
            const existingConv = await firebase.database().ref('conversations')
                .orderByChild(`participants/${currentUser.uid}`)
                .equalTo(true).once('value');

            let conversationId = null;
            const conversations = existingConv.val() || {};

            for (const [id, conv] of Object.entries(conversations)) {
                if (conv.jobId === job.id) { conversationId = id; break; }
            }

            if (!conversationId) {
                const newConvRef = firebase.database().ref('conversations').push();
                conversationId = newConvRef.key;

                await newConvRef.set({
                    jobId: job.id,
                    jobTitle: job.title,
                    participants: { [currentUser.uid]: true, [job.companyId]: true },
                    participantNames: { [currentUser.uid]: userData?.name || 'Zájemce', [job.companyId]: job.companyName },
                    createdAt: Date.now(),
                    lastMessage: `Zájem o: ${job.title}`,
                    lastMessageTime: Date.now()
                });

                await firebase.database().ref(`messages/${conversationId}`).push().set({
                    text: `Dobrý den, mám zájem o pozici: ${job.title}`,
                    senderId: currentUser.uid,
                    senderName: userData?.name || 'Zájemce',
                    timestamp: Date.now()
                });
            }

            btn.textContent = '✅ ODESLÁNO';
            btn.style.background = 'var(--color-b2b)';
            btn.disabled = true;
            showToast('✅ Zájem odeslán!');
            loadConversations(currentUser.uid);
        } catch (error) {
            console.error('Error applying:', error);
        }
    }

    // ==================== COMMENTS ====================
    let currentCommentsCompanyId = null;

    function openCommentsModal(jobId, companyId) {
        currentCommentsJobId = jobId;
        currentCommentsCompanyId = companyId;
        openModal('comments-modal');
        loadModalComments(jobId);
    }

    function loadModalComments(jobId) {
        const container = document.getElementById('modal-comments-list');

        firebase.database().ref(`comments/${jobId}`)
            .orderByChild('timestamp')
            .on('value', (snapshot) => {
                const comments = snapshot.val() || {};
                const count = Object.keys(comments).length;

                const slide = document.querySelector(`[data-job-id="${jobId}"]`);
                const label = slide?.querySelector('[data-action="comment"]')?.nextElementSibling;
                if (label) label.textContent = count;

                if (count === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Zatím žádné komentáře.</div>';
                    return;
                }

                container.innerHTML = Object.entries(comments)
                    .sort((a, b) => b[1].timestamp - a[1].timestamp)
                    .map(([id, comment]) => {
                        const canDelete = comment.userId === currentUser?.uid || isAdmin();
                        const isCompanyReply = comment.isCompanyReply;

                        return `
                            <div style="padding: 15px; border-bottom: 2px solid #eee; ${isCompanyReply ? 'background: #f0fff0; border-left: 4px solid var(--color-b2b);' : ''}">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-weight: 700; text-transform: uppercase; font-size: 0.9rem;">
                                        ${isCompanyReply ? '🏢 ' : ''}${escapeHtml(comment.userName)}
                                    </span>
                                    <div>
                                        <span style="font-size: 0.75rem; color: #999;">${formatTime(comment.timestamp)}</span>
                                        ${canDelete ? `<button onclick="deleteComment('${jobId}', '${id}')" style="background: none; border: none; cursor: pointer; font-size: 0.8rem; color: #999; margin-left: 10px;">🗑️</button>` : ''}
                                    </div>
                                </div>
                                <div style="line-height: 1.5;">${escapeHtml(comment.text)}</div>
                            </div>
                        `;
                    }).join('');
            });
    }

    window.deleteComment = async function (jobId, commentId) {
        if (!currentUser) return;
        const comment = await firebase.database().ref(`comments/${jobId}/${commentId}`).once('value');
        if (!isAdmin() && comment.val()?.userId !== currentUser.uid) return;

        try {
            await firebase.database().ref(`comments/${jobId}/${commentId}`).remove();
            showToast('🗑️ Komentář smazán');
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    document.getElementById('modal-comment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || !currentCommentsJobId) return;

        const input = document.getElementById('modal-comment-input');
        const text = input.value.trim();
        if (!text) return;

        // Companies can only comment on their own jobs (as replies)
        if (isCompany() && currentCommentsCompanyId !== currentUser.uid) {
            showToast('⚠️ Můžete komentovat pouze své inzeráty');
            return;
        }

        try {
            await firebase.database().ref(`comments/${currentCommentsJobId}`).push().set({
                text: text,
                userId: currentUser.uid,
                userName: userData?.name || 'Uživatel',
                isCompanyReply: isCompany(),
                timestamp: Date.now()
            });
            input.value = '';
            showToast('💬 Komentář přidán!');
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    });

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

    // ==================== FAVORITES ====================
    function updateFavoritesBadge(count) {
        const badge = document.getElementById('favorites-badge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    }

    async function loadFavorites(userId) {
        if (isCompany()) return; // Companies don't have favorites

        try {
            const snapshot = await firebase.database().ref(`users/${userId}/favorites`).once('value');
            const favorites = snapshot.val() || {};
            const count = Object.keys(favorites).length;

            updateFavoritesBadge(count);
            document.getElementById('profile-favorites-count').textContent = count;

            const container = document.getElementById('favorites-list');
            const emptyState = document.getElementById('favorites-empty');

            if (count === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
                container.innerHTML = Object.entries(favorites).map(([id, job]) => `
                    <div class="favorite-item" onclick="window.location.href='job-detail.html?id=${id}'">
                        <div class="favorite-thumbnail">🎬</div>
                        <div class="favorite-info">
                            <div class="favorite-title">${job.title || 'Nabídka'}</div>
                            <div class="favorite-company">${job.company || 'Firma'}</div>
                            <div class="favorite-badges"><span class="favorite-badge">${job.location || 'Lokace'}</span></div>
                        </div>
                        <button class="favorite-remove" onclick="event.stopPropagation(); removeFavorite('${id}')">✕</button>
                    </div>
                `).join('');
            }

            // Update like buttons
            loadedJobs.forEach(job => {
                const btn = document.querySelector(`[data-action="like"][data-id="${job.id}"]`);
                if (btn) btn.classList.toggle('liked', !!favorites[job.id]);
            });
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }

    window.removeFavorite = async function (jobId) {
        if (!currentUser) return;
        try {
            await firebase.database().ref(`users/${currentUser.uid}/favorites/${jobId}`).remove();
            await firebase.database().ref(`jobs/${jobId}/likes`).transaction(likes => Math.max((likes || 1) - 1, 0));
            showToast('💔 Odebráno');
            loadFavorites(currentUser.uid);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    // ==================== INBOX / MESSAGES ====================
    function updateInboxBadge(count) {
        const badge = document.getElementById('inbox-badge');
        if (badge) {
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
        }
    }

    async function loadConversations(userId) {
        firebase.database().ref('conversations')
            .orderByChild(`participants/${userId}`)
            .equalTo(true)
            .on('value', (snapshot) => {
                const conversations = snapshot.val() || {};
                const list = document.getElementById('conversations-list');
                const count = Object.keys(conversations).length;

                document.getElementById('profile-messages-count').textContent = count;

                if (count === 0) {
                    list.innerHTML = `<div class="inbox-empty"><div class="inbox-empty-icon">📭</div><h3>Žádné zprávy</h3></div>`;
                    updateInboxBadge(0);
                } else {
                    let unreadCount = 0;
                    list.innerHTML = Object.entries(conversations)
                        .sort((a, b) => (b[1].lastMessageTime || 0) - (a[1].lastMessageTime || 0))
                        .map(([id, conv]) => {
                            const isUnread = conv.lastMessage && !conv.readBy?.[userId];
                            if (isUnread) unreadCount++;
                            const otherName = conv.participantNames?.[Object.keys(conv.participants).find(p => p !== userId)] || 'Uživatel';

                            return `
                                <div class="conversation-item ${isUnread ? 'unread' : ''}" onclick="openChatFromList('${id}', '${escapeHtml(otherName)}')">
                                    <div class="conversation-avatar">💼</div>
                                    <div class="conversation-info">
                                        <div class="conversation-name">${otherName}</div>
                                        <div class="conversation-preview">${conv.lastMessage || ''}</div>
                                    </div>
                                    <div class="conversation-time">${formatTime(conv.lastMessageTime)}</div>
                                </div>
                            `;
                        }).join('');
                    updateInboxBadge(unreadCount);
                }
            });
    }

    window.openChatFromList = function (chatId, otherName) {
        currentChatId = chatId;
        document.getElementById('chat-user-name').textContent = otherName;
        document.getElementById('conversations-view').style.display = 'none';
        document.getElementById('chat-view').classList.add('active');
        if (currentUser) firebase.database().ref(`conversations/${chatId}/readBy/${currentUser.uid}`).set(true);
        loadMessages(chatId);
    };

    function closeChat() {
        currentChatId = null;
        document.getElementById('conversations-view').style.display = 'flex';
        document.getElementById('chat-view').classList.remove('active');
    }

    document.getElementById('chat-back')?.addEventListener('click', closeChat);

    function loadMessages(chatId) {
        const container = document.getElementById('chat-messages');
        firebase.database().ref(`messages/${chatId}`).orderByChild('timestamp').on('value', (snapshot) => {
            const messages = snapshot.val() || {};
            container.innerHTML = Object.values(messages).map(msg => `
                <div class="message ${msg.senderId === currentUser?.uid ? 'sent' : ''}">
                    <div class="message-bubble">${escapeHtml(msg.text)}</div>
                    <div class="message-time">${formatTime(msg.timestamp)}</div>
                </div>
            `).join('');
            container.scrollTop = container.scrollHeight;
        });
    }

    async function sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text || !currentChatId || !currentUser) return;

        try {
            await firebase.database().ref(`messages/${currentChatId}`).push().set({
                text, senderId: currentUser.uid, senderName: userData?.name || 'Uživatel', timestamp: Date.now()
            });

            const convSnapshot = await firebase.database().ref(`conversations/${currentChatId}/participants`).once('value');
            const participants = convSnapshot.val() || {};
            const updates = { lastMessage: text, lastMessageTime: Date.now(), [`readBy/${currentUser.uid}`]: true };
            for (const pid of Object.keys(participants)) if (pid !== currentUser.uid) updates[`readBy/${pid}`] = null;
            await firebase.database().ref(`conversations/${currentChatId}`).update(updates);
            input.value = '';
        } catch (error) { console.error('Error:', error); }
    }

    document.getElementById('chat-send')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // ==================== NAVBAR ====================
    document.querySelectorAll('.nav-item:not(.create-btn):not(a)').forEach(item => {
        item.addEventListener('click', () => {
            const nav = item.dataset.nav;

            if (nav === 'feed') {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
            } else if (nav === 'favorites') {
                if (!currentUser) { showToast('⚠️ Přihlaste se'); openModal('auth-modal'); }
                else if (isCompany()) { showToast('⚠️ Firmy nemají oblíbené'); }
                else openModal('favorites-modal');
            } else if (nav === 'inbox') {
                if (!currentUser) { showToast('⚠️ Přihlaste se'); openModal('auth-modal'); }
                else openModal('inbox-modal');
            } else if (nav === 'profile') {
                if (!currentUser) openModal('auth-modal');
                else openModal('profile-modal');
            } else if (nav === 'admin') {
                if (isAdmin()) {
                    openModal('admin-modal');
                    loadPendingCompanies();
                    loadCreditOrders();
                    loadAllCompanies();
                }
            }
        });
    });

    // Dashboard Click
    document.getElementById('company-dashboard-btn')?.addEventListener('click', () => {
        closeModal('profile-modal');
        openModal('dashboard-modal');
        loadCompanyJobs();
    });

    document.getElementById('nav-dash-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openModal('dashboard-modal');
        loadCompanyJobs();
    });

    // ==================== COMPANY DASHBOARD LOGIC ====================
    async function loadCompanyJobs() {
        if (!currentUser) return;
        const container = document.getElementById('company-jobs-list');
        const statsGrid = document.getElementById('dashboard-total-stats');

        try {
            const snapshot = await firebase.database().ref('jobs').once('value');
            const jobsData = snapshot.val() || {};

            // Fetch comments counts
            const commentsSnapshot = await firebase.database().ref('comments').once('value');
            const commentsData = commentsSnapshot.val() || {};

            const companyJobs = Object.entries(jobsData)
                .map(([id, data]) => {
                    const jobComments = commentsData[id] || {};
                    const count = Object.keys(jobComments).length;
                    return { id, ...data, actualCommentsCount: count };
                })
                .filter(job => job.companyId === currentUser.uid || job.userId === currentUser.uid);

            // Update stats
            document.getElementById('profile-jobs-count').textContent = companyJobs.length;

            let totalViews = 0;
            let totalLikes = 0;
            let totalComments = 0;

            companyJobs.forEach(job => {
                totalViews += (job.views || 0);
                totalLikes += (job.likes || 0);
                totalComments += (job.actualCommentsCount || 0);
            });

            statsGrid.innerHTML = `
                <div class="dashboard-stat-card">
                    <div class="stat-value">${totalViews}</div>
                    <div class="stat-label">👀 Zobrazení</div>
                </div>
                <div class="dashboard-stat-card">
                    <div class="stat-value">${totalLikes}</div>
                    <div class="stat-label">❤️ Lajky</div>
                </div>
                <div class="dashboard-stat-card">
                    <div class="stat-value">${totalComments}</div>
                    <div class="stat-label">💬 Komentáře</div>
                </div>
            `;

            if (companyJobs.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: #666;">Zatím jste nepřidali žádný inzerát.</div>`;
            } else {
                container.innerHTML = companyJobs.map(job => `
                    <div class="dashboard-job-card">
                        <div class="dashboard-job-header">
                            <div class="dashboard-job-title">${job.title}</div>
                            <div style="font-size: 0.75rem; color: #666;">ID: ${job.id}</div>
                        </div>
                        <div class="dashboard-job-stats-mini">
                            <div class="job-stat-mini">👀 ${job.views || 0}</div>
                            <div class="job-stat-mini">❤️ ${job.likes || 0}</div>
                            <div class="job-stat-mini">💬 ${job.actualCommentsCount || 0}</div>
                        </div>
                        <div class="dashboard-job-actions">
                            <button class="dash-btn dash-btn-edit" onclick="editJob('${job.id}')">✏️ Editovat</button>
                            <button class="dash-btn dash-btn-delete" onclick="deleteJobFromDash('${job.id}')">🗑️ Smazat</button>
                            <a href="job-detail.html?id=${job.id}" class="dash-btn" style="background: #eee; text-decoration: none; color: #000;">👁️ Zobrazit</a>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: red;">Chyba při načítání dat.</div>`;
        }
    }


    window.deleteJobFromDash = async function (jobId) {
        if (!confirm('Opravdu chcete tento inzerát smazat?')) return;

        try {
            await firebase.database().ref(`jobs/${jobId}`).remove();
            showToast('🗑️ Inzerát smazán');
            loadCompanyJobs(); // Reload dashboard
            loadJobs(); // Reload feed
        } catch (error) {
            console.error('Error deleting job:', error);
            showToast('❌ Chyba při mazání');
        }
    };

    window.editJob = function (jobId) {
        window.location.href = `job-form.html?edit=${jobId}`;
    };


    // ==================== NAVBAR VISIBILITY LOGIC ====================
    let lastScrollTop = 0;
    const navbar = document.getElementById('main-nav');
    const appContainer = document.getElementById('app');

    if (appContainer && navbar) {
        appContainer.addEventListener('scroll', () => {
            const scrollTop = appContainer.scrollTop;

            // Show if scrolling up OR at the very top
            if (scrollTop < lastScrollTop || scrollTop < 50) {
                navbar.classList.remove('nav-hidden');
            }
            // Hide if scrolling down AND not at the top
            else if (scrollTop > lastScrollTop && scrollTop > 100) {
                navbar.classList.add('nav-hidden');
            }

            lastScrollTop = scrollTop;
        }, { passive: true });
    }

    document.getElementById('cta-jobs')?.addEventListener('click', (e) => {
        e.preventDefault();
        const firstSlide = document.querySelector('.slide');
        if (firstSlide) firstSlide.scrollIntoView({ behavior: 'smooth' });
    });

    // ==================== KEYBOARD NAV ====================
    document.addEventListener('keydown', (e) => {
        if (document.querySelector('.modal-overlay.active') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const app = document.getElementById('app');
        if (!app) return;

        if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); app.scrollBy({ top: window.innerHeight, behavior: 'smooth' }); }
        else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); app.scrollBy({ top: -window.innerHeight, behavior: 'smooth' }); }
        else if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    });

    // ==================== INIT ====================
    loadJobs();
    console.log('🎬 JobTik with Roles loaded!');
});
