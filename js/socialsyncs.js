// SocialSyncs - Complete Social Media Automation Platform
// Based on the SocialSyncs architecture but adapted for HTML/CSS/JS

class SocialSyncsClient {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // ===== PROFILE MANAGEMENT =====
  
  async getProfile() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateProfile(updates) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // ===== PLATFORM CREDENTIALS =====
  
  async getCredentials(platform) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;

    let query = this.supabase
      .from('platform_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async saveCredentials(platform, credentials) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('platform_credentials')
      .upsert({
        user_id: user.id,
        platform,
        credentials,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteCredentials(platform) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('platform_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', platform);
    
    if (error) throw error;
    return data;
  }

  // ===== POST MANAGEMENT =====
  
  async createPost(postData) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('posts')
      .insert({
        user_id: user.id,
        platform: postData.platform,
        post_type: postData.post_type,
        caption: postData.caption,
        media_urls: postData.media_urls,
        cover_url: postData.cover_url,
        audio_name: postData.audio_name,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getPosts(filters = {}) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    let query = this.supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (filters.platform) {
      query = query.eq('platform', filters.platform);
    }
    
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async updatePost(postId, updates) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deletePost(postId) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);
    
    if (error) throw error;
    return data;
  }

  // ===== OAUTH CONNECTIONS =====
  
  async getOAuthConnections(platform) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    let query = this.supabase
      .from('platform_oauth_connections')
      .select('*')
      .eq('user_id', user.id);
    
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async saveOAuthConnection(connectionData) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('platform_oauth_connections')
      .upsert({
        user_id: user.id,
        ...connectionData
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteOAuthConnection(platform) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('platform_oauth_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', platform);
    
    if (error) throw error;
    return data;
  }

  // ===== MEDIA GALLERY =====
  
  async uploadMedia(file, options = {}) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from('post-media')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from('post-media')
      .getPublicUrl(filePath);

    // Determine media type
    const mediaType = file.type.startsWith('video') ? 'video' : 'image';

    // Get file dimensions if image
    let width, height;
    if (mediaType === 'image') {
      const dimensions = await this.getImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
    }

    // Save to user_media table
    const { data, error } = await this.supabase
      .from('user_media')
      .insert({
        user_id: user.id,
        file_name: file.name,
        storage_path: filePath,
        public_url: publicUrl,
        media_type,
        file_size: file.size,
        width,
        height,
        duration_seconds: options.duration_seconds
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getMediaGallery() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('user_media')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async deleteMedia(mediaId) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get media info first
    const { data: media } = await this.supabase
      .from('user_media')
      .select('storage_path')
      .eq('id', mediaId)
      .eq('user_id', user.id)
      .single();

    if (!media) throw new Error('Media not found');

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from('post-media')
      .remove([media.storage_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { data, error } = await this.supabase
      .from('user_media')
      .delete()
      .eq('id', mediaId)
      .eq('user_id', user.id);
    
    if (error) throw error;
    return data;
  }

  getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ===== YOUTUBE AUTOMATION =====
  
  async addYouTubeVideo(videoData) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('youtube_videos')
      .insert({
        user_id: user.id,
        video_id: videoData.video_id,
        title: videoData.title,
        thumbnail_url: videoData.thumbnail_url,
        published_at: videoData.published_at
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getYouTubeVideos() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('youtube_videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async updateYouTubeAutomationConfig(videoId, config) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('youtube_automation_configs')
      .upsert({
        user_id: user.id,
        video_id: videoId,
        ...config
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getYouTubeAutomationConfig(videoId) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('youtube_automation_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  }

  async saveYouTubeCommentReply(replyData) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('youtube_comment_replies')
      .insert({
        user_id: user.id,
        ...replyData
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getYouTubeCommentReplies(videoId) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('youtube_comment_replies')
      .select('*')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async updateYouTubeCommentReply(replyId, updates) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('youtube_comment_replies')
      .update(updates)
      .eq('id', replyId)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // ===== API KEYS =====
  
  async createAPIKey(name) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate API key
    const apiKey = `sk_${this.generateRandomString(32)}`;
    
    // Simple hash (in production, use proper hashing)
    const keyHash = this.simpleHash(apiKey);

    const { data, error } = await this.supabase
      .from('user_api_keys')
      .insert({
        user_id: user.id,
        name,
        key_hash: keyHash
      })
      .select()
      .single();
    
    if (error) throw error;
    return { ...data, plain_key: apiKey };
  }

  async getAPIKeys() {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async deleteAPIKey(keyId) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('user_api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', user.id);
    
    if (error) throw error;
    return data;
  }

  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  // ===== INSTAGRAM API INTEGRATION =====
  
  async createInstagramContainer(postData, accessToken) {
    const credentials = await this.getCredentials('instagram');
    if (!credentials || !credentials[0]) {
      throw new Error('Instagram credentials not found');
    }

    const accountId = credentials[0].credentials.instagram_business_id;
    const IG_GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';

    let endpoint;
    let body = {};

    switch (postData.post_type) {
      case 'image':
        endpoint = `/${accountId}/media`;
        body = {
          image_url: postData.media_urls[0],
          caption: postData.caption || ''
        };
        break;
      case 'reel':
        endpoint = `/${accountId}/media`;
        body = {
          media_type: 'REELS',
          video_url: postData.media_urls[0],
          caption: postData.caption || ''
        };
        if (postData.cover_url) body.cover_url = postData.cover_url;
        if (postData.audio_name) body.audio_name = postData.audio_name;
        break;
      case 'carousel':
        // First create child containers
        const childIds = await Promise.all(
          postData.media_urls.map(url =>
            this.instagramApiCall(`${IG_GRAPH_BASE_URL}/${accountId}/media`, {
              image_url: url,
              is_carousel_item: 'true'
            }, accessToken)
          )
        );

        endpoint = `/${accountId}/media`;
        body = {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: postData.caption || ''
        };
        break;
      case 'story_image':
        endpoint = `/${accountId}/media`;
        body = {
          media_type: 'STORIES',
          image_url: postData.media_urls[0]
        };
        break;
      case 'story_video':
        endpoint = `/${accountId}/media`;
        body = {
          media_type: 'STORIES',
          video_url: postData.media_urls[0]
        };
        break;
      default:
        throw new Error(`Unsupported post type: ${postData.post_type}`);
    }

    const response = await this.instagramApiCall(
      `${IG_GRAPH_BASE_URL}${endpoint}`,
      body,
      accessToken
    );

    // Update post with container ID
    await this.updatePost(postData.id, {
      container_id: response.id,
      status: 'processing'
    });

    return response;
  }

  async checkInstagramContainerStatus(containerId, accessToken) {
    const IG_GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';
    
    const response = await this.instagramApiCall(
      `${IG_GRAPH_BASE_URL}/${containerId}`,
      { fields: 'status_code' },
      accessToken,
      'GET'
    );

    return {
      statusCode: response.status_code,
      isReady: response.status_code === 'FINISHED'
    };
  }

  async publishInstagramPost(containerId, postId, accessToken) {
    const credentials = await this.getCredentials('instagram');
    if (!credentials || !credentials[0]) {
      throw new Error('Instagram credentials not found');
    }

    const accountId = credentials[0].credentials.instagram_business_id;
    const IG_GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';

    const response = await this.instagramApiCall(
      `${IG_GRAPH_BASE_URL}/${accountId}/media_publish`,
      { creation_id: containerId },
      accessToken
    );

    // Update post as published
    await this.updatePost(postId, {
      published_media_id: response.id,
      status: 'published',
      published_at: new Date().toISOString(),
      platform_response: response
    });

    return response;
  }

  async instagramApiCall(url, body, accessToken, method = 'POST') {
    const urlObj = new URL(url);
    
    // Add query parameters
    if (method === 'GET') {
      Object.keys(body).forEach(key => {
        urlObj.searchParams.set(key, body[key]);
      });
    }

    const response = await fetch(urlObj.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Instagram API error');
    }

    return data;
  }

  // ===== UTILITY METHODS =====
  
  async pollInstagramPostStatus(postId, accessToken, maxAttempts = 20, interval = 5000) {
    const post = await this.getPosts({}).then(posts => posts.find(p => p.id === postId));
    if (!post || !post.container_id) {
      throw new Error('Post not found or no container ID');
    }

    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.checkInstagramContainerStatus(post.container_id, accessToken);
      
      if (status.isReady) {
        return await this.publishInstagramPost(post.container_id, postId, accessToken);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Container not ready after maximum attempts');
  }
}

// Initialize SocialSyncs client
let socialSyncsClient = null;

function getSocialSyncsClient() {
  if (!socialSyncsClient && window.supabase) {
    socialSyncsClient = new SocialSyncsClient(window.supabase);
  }
  return socialSyncsClient;
}