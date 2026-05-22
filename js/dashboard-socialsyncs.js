// Dashboard Controller for SocialSyncs
class DashboardController {
  constructor() {
    this.socialSyncs = getSocialSyncsClient();
    this.selectedMedia = [];
    this.init();
  }

  async init() {
    if (!this.socialSyncs) {
      console.error('SocialSyncs client not initialized');
      return;
    }

    // Check authentication
    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      window.location.href = 'auth.html';
      return;
    }

    this.setupEventListeners();
    await this.loadDashboard();
  }

  async checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo(item.dataset.section);
      });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      supabase.auth.signOut();
      window.location.href = 'auth.html';
    });

    // Create Post Form
    document.getElementById('create-post-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreatePost();
    });

    // Post Type Change
    document.getElementById('post-type').addEventListener('change', (e) => {
      this.togglePostTypeFields(e.target.value);
    });

    // Media Input
    document.getElementById('media-input').addEventListener('change', (e) => {
      this.handleMediaSelection(e.target.files);
    });

    // Select from Gallery
    document.getElementById('select-from-gallery').addEventListener('click', () => {
      this.openGalleryModal();
    });

    // Gallery Modal
    document.querySelector('.modal-close').addEventListener('click', () => {
      this.closeGalleryModal();
    });

    // Upload Media
    document.getElementById('upload-btn').addEventListener('click', () => {
      document.getElementById('upload-media').click();
    });

    document.getElementById('upload-media').addEventListener('change', (e) => {
      this.handleMediaUpload(e.target.files);
    });

    // Filters
    document.getElementById('filter-platform').addEventListener('change', () => {
      this.loadPostHistory();
    });

    document.getElementById('filter-status').addEventListener('change', () => {
      this.loadPostHistory();
    });

    // Profile Form
    document.getElementById('profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleProfileUpdate();
    });

    // Instagram Credentials
    document.getElementById('instagram-credentials-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleInstagramCredentials();
    });

    document.getElementById('clear-instagram-credentials').addEventListener('click', () => {
      this.handleClearInstagramCredentials();
    });

    // API Key
    document.getElementById('api-key-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateAPIKey();
    });

    // Add YouTube Video
    document.getElementById('add-video-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddYouTubeVideo();
    });
  }

  navigateTo(section) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.remove('active');
    });
    document.getElementById(`section-${section}`).classList.add('active');

    // Load section-specific data
    switch (section) {
      case 'overview':
        this.loadOverview();
        break;
      case 'history':
        this.loadPostHistory();
        break;
      case 'gallery':
        this.loadMediaGallery();
        break;
      case 'youtube':
        this.loadYouTubeSection();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  }

  async loadDashboard() {
    await Promise.all([
      this.loadUserInfo(),
      this.loadOverview(),
      this.loadSettings()
    ]);
  }

  async loadUserInfo() {
    try {
      const profile = await this.socialSyncs.getProfile();
      const userInfo = document.getElementById('user-info');
      userInfo.innerHTML = `
        <div class="user-avatar">
          ${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="Avatar" />` : '<div class="avatar-placeholder">👤</div>'}
        </div>
        <div class="user-details">
          <div class="user-name">${profile.display_name || 'User'}</div>
        </div>
      `;
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  }

  async loadOverview() {
    try {
      const posts = await this.socialSyncs.getPosts();
      const media = await this.socialSyncs.getMediaGallery();

      // Update stats
      document.getElementById('total-posts').textContent = posts.length;
      document.getElementById('published-posts').textContent = posts.filter(p => p.status === 'published').length;
      document.getElementById('pending-posts').textContent = posts.filter(p => p.status === 'pending' || p.status === 'processing').length;
      document.getElementById('total-media').textContent = media.length;

      // Load recent posts
      const recentPosts = posts.slice(0, 5);
      this.renderRecentPosts(recentPosts);
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  }

  renderRecentPosts(posts) {
    const container = document.getElementById('recent-posts');
    if (posts.length === 0) {
      container.innerHTML = '<p class="empty-state">No posts yet</p>';
      return;
    }

    container.innerHTML = posts.map(post => `
      <div class="post-item">
        <div class="post-preview">
          ${post.media_urls[0] ? `<img src="${post.media_urls[0]}" alt="Post" />` : '<div class="no-preview">No preview</div>'}
        </div>
        <div class="post-details">
          <div class="post-platform">${post.platform}</div>
          <div class="post-type">${post.post_type}</div>
          <div class="post-status status-${post.status}">${post.status}</div>
          <div class="post-date">${new Date(post.created_at).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');
  }

  async loadPostHistory() {
    try {
      const platform = document.getElementById('filter-platform').value;
      const status = document.getElementById('filter-status').value;
      
      const posts = await this.socialSyncs.getPosts({
        platform: platform || undefined,
        status: status || undefined
      });

      this.renderPostHistory(posts);
    } catch (error) {
      console.error('Error loading post history:', error);
    }
  }

  renderPostHistory(posts) {
    const container = document.getElementById('posts-history');
    if (posts.length === 0) {
      container.innerHTML = '<p class="empty-state">No posts found</p>';
      return;
    }

    container.innerHTML = posts.map(post => `
      <div class="post-item expanded">
        <div class="post-preview">
          ${post.media_urls[0] ? `<img src="${post.media_urls[0]}" alt="Post" />` : '<div class="no-preview">No preview</div>'}
        </div>
        <div class="post-details">
          <div class="post-platform">${post.platform}</div>
          <div class="post-type">${post.post_type}</div>
          <div class="post-status status-${post.status}">${post.status}</div>
          <div class="post-date">${new Date(post.created_at).toLocaleDateString()}</div>
          ${post.caption ? `<div class="post-caption">${post.caption.substring(0, 100)}...</div>` : ''}
          ${post.error_message ? `<div class="post-error">${post.error_message}</div>` : ''}
          ${post.status === 'processing' ? `<button class="btn-small" onclick="dashboardController.checkPostStatus('${post.id}')">Check Status</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  async checkPostStatus(postId) {
    try {
      const post = (await this.socialSyncs.getPosts()).find(p => p.id === postId);
      if (!post || !post.container_id) return;

      const credentials = await this.socialSyncs.getCredentials('instagram');
      if (!credentials || !credentials[0]) {
        alert('Instagram credentials not found');
        return;
      }

      const accessToken = credentials[0].credentials.access_token;
      const status = await this.socialSyncs.checkInstagramContainerStatus(post.container_id, accessToken);

      if (status.isReady) {
        await this.socialSyncs.publishInstagramPost(post.container_id, postId, accessToken);
        this.loadPostHistory();
        this.showToast('Post published successfully!', 'success');
      } else {
        this.showToast(`Post status: ${status.statusCode}`, 'info');
      }
    } catch (error) {
      console.error('Error checking post status:', error);
      this.showToast('Error checking post status', 'error');
    }
  }

  async loadMediaGallery() {
    try {
      const media = await this.socialSyncs.getMediaGallery();
      this.renderMediaGallery(media);
    } catch (error) {
      console.error('Error loading media gallery:', error);
    }
  }

  renderMediaGallery(media) {
    const container = document.getElementById('media-gallery');
    if (media.length === 0) {
      container.innerHTML = '<p class="empty-state">No media uploaded yet</p>';
      return;
    }

    container.innerHTML = media.map(item => `
      <div class="media-item">
        <div class="media-preview">
          ${item.media_type === 'video' 
            ? `<video src="${item.public_url}" muted></video>`
            : `<img src="${item.public_url}" alt="${item.file_name}" />`
          }
        </div>
        <div class="media-info">
          <div class="media-name">${item.file_name}</div>
          <div class="media-type">${item.media_type}</div>
          <div class="media-date">${new Date(item.created_at).toLocaleDateString()}</div>
          <button class="btn-danger btn-small" onclick="dashboardController.deleteMedia('${item.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  async handleMediaUpload(files) {
    if (!files || files.length === 0) return;

    try {
      for (const file of files) {
        await this.socialSyncs.uploadMedia(file);
      }
      this.showToast('Media uploaded successfully!', 'success');
      this.loadMediaGallery();
    } catch (error) {
      console.error('Error uploading media:', error);
      this.showToast('Error uploading media', 'error');
    }
  }

  async deleteMedia(mediaId) {
    if (!confirm('Are you sure you want to delete this media?')) return;

    try {
      await this.socialSyncs.deleteMedia(mediaId);
      this.showToast('Media deleted successfully!', 'success');
      this.loadMediaGallery();
    } catch (error) {
      console.error('Error deleting media:', error);
      this.showToast('Error deleting media', 'error');
    }
  }

  async loadYouTubeSection() {
    try {
      const videos = await this.socialSyncs.getYouTubeVideos();
      this.renderYouTubeVideos(videos);
    } catch (error) {
      console.error('Error loading YouTube section:', error);
    }
  }

  renderYouTubeVideos(videos) {
    const container = document.getElementById('youtube-videos');
    if (videos.length === 0) {
      container.innerHTML = '<p class="empty-state">No videos added yet</p>';
      return;
    }

    container.innerHTML = videos.map(video => `
      <div class="youtube-video-item">
        <div class="video-thumbnail">
          ${video.thumbnail_url ? `<img src="${video.thumbnail_url}" alt="${video.title}" />` : '<div class="no-thumbnail">No thumbnail</div>'}
        </div>
        <div class="video-info">
          <div class="video-title">${video.title}</div>
          <div class="video-id">ID: ${video.video_id}</div>
          <div class="video-date">${new Date(video.created_at).toLocaleDateString()}</div>
          <button class="btn-small" onclick="dashboardController.configureYouTubeAutomation('${video.video_id}')">Configure Automation</button>
        </div>
      </div>
    `).join('');
  }

  async handleAddYouTubeVideo() {
    const videoId = document.getElementById('youtube-video-id').value.trim();
    if (!videoId) return;

    try {
      // In a real implementation, you would fetch video details from YouTube API
      await this.socialSyncs.addYouTubeVideo({
        video_id: videoId,
        title: `Video ${videoId}`,
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        published_at: new Date().toISOString()
      });

      this.showToast('Video added successfully!', 'success');
      document.getElementById('youtube-video-id').value = '';
      this.loadYouTubeSection();
    } catch (error) {
      console.error('Error adding YouTube video:', error);
      this.showToast('Error adding video', 'error');
    }
  }

  async configureYouTubeAutomation(videoId) {
    // This would open a configuration modal
    alert(`Configure automation for video ${videoId}`);
  }

  async loadSettings() {
    try {
      const profile = await this.socialSyncs.getProfile();
      const credentials = await this.socialSyncs.getCredentials('instagram');
      const apiKeys = await this.socialSyncs.getAPIKeys();

      // Load profile
      if (profile) {
        document.getElementById('display-name').value = profile.display_name || '';
        document.getElementById('avatar-url').value = profile.avatar_url || '';
      }

      // Load credentials (masked)
      if (credentials && credentials[0]) {
        document.getElementById('ig-business-id').value = credentials[0].credentials.instagram_business_id || '';
        document.getElementById('fb-page-id').value = credentials[0].credentials.fb_page_id || '';
        document.getElementById('page-token').value = credentials[0].credentials.access_token ? '••••••••' : '';
      }

      // Load API keys
      this.renderAPIKeys(apiKeys);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  renderAPIKeys(apiKeys) {
    const container = document.getElementById('api-keys-list');
    if (apiKeys.length === 0) {
      container.innerHTML = '<p class="empty-state">No API keys generated yet</p>';
      return;
    }

    container.innerHTML = apiKeys.map(key => `
      <div class="api-key-item">
        <div class="api-key-name">${key.name}</div>
        <div class="api-key-hash">••••${key.key_hash.substring(0, 8)}</div>
        <div class="api-key-date">${new Date(key.created_at).toLocaleDateString()}</div>
        <button class="btn-danger btn-small" onclick="dashboardController.deleteAPIKey('${key.id}')">Delete</button>
      </div>
    `).join('');
  }

  async handleProfileUpdate() {
    const displayName = document.getElementById('display-name').value.trim();
    const avatarUrl = document.getElementById('avatar-url').value.trim();

    try {
      await this.socialSyncs.updateProfile({
        display_name: displayName,
        avatar_url: avatarUrl
      });

      this.showToast('Profile updated successfully!', 'success');
      this.loadUserInfo();
    } catch (error) {
      console.error('Error updating profile:', error);
      this.showToast('Error updating profile', 'error');
    }
  }

  async handleInstagramCredentials() {
    const businessId = document.getElementById('ig-business-id').value.trim();
    const pageId = document.getElementById('fb-page-id').value.trim();
    const accessToken = document.getElementById('page-token').value.trim();

    if (!businessId || !pageId || !accessToken) {
      this.showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      await this.socialSyncs.saveCredentials('instagram', {
        instagram_business_id: businessId,
        fb_page_id: pageId,
        access_token: accessToken
      });

      this.showToast('Credentials saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving credentials:', error);
      this.showToast('Error saving credentials', 'error');
    }
  }

  async handleClearInstagramCredentials() {
    if (!confirm('Are you sure you want to clear your Instagram credentials?')) return;

    try {
      await this.socialSyncs.deleteCredentials('instagram');
      document.getElementById('ig-business-id').value = '';
      document.getElementById('fb-page-id').value = '';
      document.getElementById('page-token').value = '';
      this.showToast('Credentials cleared successfully!', 'success');
    } catch (error) {
      console.error('Error clearing credentials:', error);
      this.showToast('Error clearing credentials', 'error');
    }
  }

  async handleCreateAPIKey() {
    const name = document.getElementById('api-key-name').value.trim();
    if (!name) {
      this.showToast('Please enter a name for the API key', 'error');
      return;
    }

    try {
      const result = await this.socialSyncs.createAPIKey(name);
      
      // Show the API key (only time it's visible)
      alert(`Your API Key: ${result.plain_key}\n\nSave this key securely. You won't be able to see it again.`);
      
      document.getElementById('api-key-name').value = '';
      this.loadSettings();
    } catch (error) {
      console.error('Error creating API key:', error);
      this.showToast('Error creating API key', 'error');
    }
  }

  async deleteAPIKey(keyId) {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await this.socialSyncs.deleteAPIKey(keyId);
      this.showToast('API key deleted successfully!', 'success');
      this.loadSettings();
    } catch (error) {
      console.error('Error deleting API key:', error);
      this.showToast('Error deleting API key', 'error');
    }
  }

  togglePostTypeFields(postType) {
    const coverGroup = document.getElementById('cover-url-group');
    const audioGroup = document.getElementById('audio-name-group');

    coverGroup.style.display = postType === 'reel' ? 'block' : 'none';
    audioGroup.style.display = postType === 'reel' ? 'block' : 'none';
  }

  handleMediaSelection(files) {
    this.selectedMedia = Array.from(files);
    this.renderMediaPreview();
  }

  renderMediaPreview() {
    const container = document.getElementById('media-preview');
    
    if (this.selectedMedia.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.selectedMedia.map((file, index) => {
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video');
      
      return `
        <div class="preview-item">
          <div class="preview-media">
            ${isVideo 
              ? `<video src="${url}" muted></video>` 
              : `<img src="${url}" alt="${file.name}" />`
            }
          </div>
          <button type="button" class="remove-preview" onclick="dashboardController.removeSelectedMedia(${index})">&times;</button>
        </div>
      `;
    }).join('');
  }

  removeSelectedMedia(index) {
    this.selectedMedia.splice(index, 1);
    this.renderMediaPreview();
  }

  async openGalleryModal() {
    try {
      const media = await this.socialSyncs.getMediaGallery();
      const container = document.getElementById('modal-gallery');
      
      container.innerHTML = media.map(item => `
        <div class="gallery-item ${this.selectedMedia.some(m => m.public_url === item.public_url) ? 'selected' : ''}" 
             onclick="dashboardController.toggleGallerySelection('${item.id}')"
             data-id="${item.id}"
             data-url="${item.public_url}">
          <div class="gallery-preview">
            ${item.media_type === 'video' 
              ? `<video src="${item.public_url}" muted></video>`
              : `<img src="${item.public_url}" alt="${item.file_name}" />`
            }
          </div>
          <div class="gallery-name">${item.file_name}</div>
        </div>
      `).join('');

      document.getElementById('gallery-modal').style.display = 'block';
    } catch (error) {
      console.error('Error opening gallery modal:', error);
      this.showToast('Error loading gallery', 'error');
    }
  }

  closeGalleryModal() {
    document.getElementById('gallery-modal').style.display = 'none';
  }

  toggleGallerySelection(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    item.classList.toggle('selected');
    // In a real implementation, you'd add/remove from selectedMedia
  }

  async handleCreatePost() {
    const platform = document.getElementById('post-platform').value;
    const postType = document.getElementById('post-type').value;
    const caption = document.getElementById('post-caption').value;
    const coverUrl = document.getElementById('cover-url').value;
    const audioName = document.getElementById('audio-name').value;

    if (!platform || !postType) {
      this.showToast('Please select platform and post type', 'error');
      return;
    }

    if (this.selectedMedia.length === 0) {
      this.showToast('Please select at least one media file', 'error');
      return;
    }

    try {
      // Upload media first
      const mediaUrls = [];
      for (const file of this.selectedMedia) {
        const uploaded = await this.socialSyncs.uploadMedia(file);
        mediaUrls.push(uploaded.public_url);
      }

      // Create post
      const post = await this.socialSyncs.createPost({
        platform,
        post_type: postType,
        caption,
        media_urls: mediaUrls,
        cover_url: coverUrl || null,
        audio_name: audioName || null
      });

      // Start Instagram posting process
      if (platform === 'instagram') {
        const credentials = await this.socialSyncs.getCredentials('instagram');
        if (!credentials || !credentials[0]) {
          this.showToast('Instagram credentials not found. Please add them in Settings.', 'error');
          return;
        }

        const accessToken = credentials[0].credentials.access_token;
        await this.socialSyncs.createInstagramContainer(post, accessToken);
        
        // Start polling for status
        this.socialSyncs.pollInstagramPostStatus(post.id, accessToken)
          .then(() => {
            this.showToast('Post published successfully!', 'success');
            this.loadOverview();
          })
          .catch(error => {
            console.error('Error publishing post:', error);
            this.showToast('Error publishing post', 'error');
          });
      } else {
        this.showToast('Post created successfully!', 'success');
      }

      // Reset form
      document.getElementById('create-post-form').reset();
      this.selectedMedia = [];
      this.renderMediaPreview();
      this.loadOverview();
    } catch (error) {
      console.error('Error creating post:', error);
      this.showToast('Error creating post: ' + error.message, 'error');
    }
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize dashboard
let dashboardController;

document.addEventListener('DOMContentLoaded', () => {
  dashboardController = new DashboardController();
});