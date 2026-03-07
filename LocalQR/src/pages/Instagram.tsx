import { useState } from "react";
import { Instagram as InstagramIcon, Link as LinkIcon, Search, Image as ImageIcon, MapPin, User, Grid3X3, Film, ExternalLink, Loader2 } from "lucide-react";
import { instagramService } from "../services/instagramService";
import type { InstagramPostData, InstagramProfileData, AccountPostsData } from "../services/instagramService";
import useAuthStore from "../store/store";

const API_BASE_URL = import.meta.env.VITE_INSTAGRAM_API_URL || 'http://localhost:5000';

/**
 * Proxy an Instagram CDN URL through our backend to bypass CORS.
 * Falls back to raw URL if it's not an Instagram CDN link.
 */
function proxyUrl(url: string, token: string | null): string {
    if (!url) return url;
    // Only proxy Instagram CDN URLs
    const needsProxy = ['cdninstagram.com', 'fbcdn.net', 'instagram.f'].some(d => url.includes(d));
    if (!needsProxy) return url;
    return `${API_BASE_URL}/api/instagram/media-proxy?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token || '')}`;
}

const Instagram = () => {
    const [activeTab, setActiveTab] = useState<'post' | 'profile' | 'account'>('post');
    const [postUrl, setPostUrl] = useState("");
    const [profileInput, setProfileInput] = useState("");
    const [accountInput, setAccountInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [extractedPost, setExtractedPost] = useState<InstagramPostData | null>(null);
    const [extractedProfile, setExtractedProfile] = useState<InstagramProfileData | null>(null);
    const [accountData, setAccountData] = useState<AccountPostsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [accountFilter, setAccountFilter] = useState<'all' | 'post' | 'reel'>('all');

    const token = useAuthStore((state) => state.token);
    const px = (url: string) => proxyUrl(url, token);

    const handleExtractPost = async () => {
        if (!postUrl.trim()) {
            setError("Please enter an Instagram post URL");
            return;
        }

        setLoading(true);
        setError(null);
        setExtractedPost(null);

        try {
            const data = await instagramService.extractPost(postUrl);
            setExtractedPost(data);
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || "Failed to extract post";
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleExtractProfile = async () => {
        if (!profileInput.trim()) {
            setError("Please enter a username or profile URL");
            return;
        }

        setLoading(true);
        setError(null);
        setExtractedProfile(null);

        try {
            const data = await instagramService.extractProfile(profileInput);
            setExtractedProfile(data);
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || "Failed to extract profile";
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleScrapeAccount = async () => {
        if (!accountInput.trim()) {
            setError("Please enter a username or profile URL");
            return;
        }

        setLoading(true);
        setError(null);
        setAccountData(null);

        try {
            const data = await instagramService.extractAccountPosts(accountInput);
            setAccountData(data);
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || "Failed to scrape account";
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (activeTab === 'post') handleExtractPost();
            else if (activeTab === 'profile') handleExtractProfile();
            else handleScrapeAccount();
        }
    };

    const filteredPosts = accountData?.posts.filter(p => {
        if (accountFilter === 'all') return true;
        return p.type === accountFilter;
    }) || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-2xl">
                            <InstagramIcon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Instagram Data Extractor
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Extract posts, profiles, and scrape entire accounts from public Instagram
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => { setActiveTab('post'); setError(null); setExtractedPost(null); }}
                            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${activeTab === 'post'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <ImageIcon className="w-5 h-5" />
                                Extract Post
                            </div>
                        </button>
                        <button
                            onClick={() => { setActiveTab('profile'); setError(null); setExtractedProfile(null); }}
                            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${activeTab === 'profile'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <User className="w-5 h-5" />
                                Extract Profile
                            </div>
                        </button>
                        <button
                            onClick={() => { setActiveTab('account'); setError(null); setAccountData(null); }}
                            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${activeTab === 'account'
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Grid3X3 className="w-5 h-5" />
                                Scrape Account
                            </div>
                        </button>
                    </div>

                    {/* Input Section */}
                    {activeTab === 'post' ? (
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <LinkIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={postUrl}
                                    onChange={(e) => setPostUrl(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Paste Instagram post URL (e.g., https://instagram.com/p/ABC123...)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleExtractPost}
                                disabled={loading}
                                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                            >
                                <Search className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? 'Extracting...' : 'Extract'}
                            </button>
                        </div>
                    ) : activeTab === 'profile' ? (
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={profileInput}
                                    onChange={(e) => setProfileInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Username or profile URL (e.g., @nasa or https://instagram.com/nasa)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleExtractProfile}
                                disabled={loading}
                                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                            >
                                <Search className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? 'Extracting...' : 'Extract'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Grid3X3 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={accountInput}
                                    onChange={(e) => setAccountInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Username or profile URL (e.g., @natgeo or https://instagram.com/natgeo)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleScrapeAccount}
                                disabled={loading}
                                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Search className="w-5 h-5" />
                                )}
                                {loading ? 'Scraping...' : 'Scrape All'}
                            </button>
                        </div>
                    )}

                    {/* Loading indicator for account scrape */}
                    {loading && activeTab === 'account' && (
                        <div className="mt-4 bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                                <div>
                                    <p className="font-semibold text-orange-900">Scraping account posts...</p>
                                    <p className="text-sm text-orange-700">This may take 30–60 seconds depending on how many posts the account has. The scraper scrolls through the profile to load all posts.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-lg">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                                <p className="text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Extracted Post */}
                {extractedPost && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 animate-in fade-in duration-500">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <ImageIcon className="w-6 h-6 text-purple-600" />
                            Extracted Post
                        </h2>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Media Carousel */}
                            <div className="relative rounded-xl overflow-hidden shadow-lg bg-black/5">
                                {extractedPost.media && extractedPost.media.length > 1 ? (
                                    <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide" style={{ scrollBehavior: 'smooth' }}>
                                        {extractedPost.media.map((item, index) => (
                                            <div key={index} className="flex-shrink-0 w-full aspect-square snap-center relative group">
                                                {item.type === 'video' ? (
                                                    <video
                                                        src={px(item.url)}
                                                        controls
                                                        className="w-full h-full object-contain bg-black"
                                                    />
                                                ) : (
                                                    <img
                                                        src={px(item.url)}
                                                        alt={`Slide ${index + 1}`}
                                                        className="w-full h-full object-contain bg-gray-100"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                        }}
                                                    />
                                                )}
                                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                                    {index + 1}/{extractedPost.media?.length}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="aspect-square relative">
                                        <img
                                            src={px(extractedPost.thumbnailUrl)}
                                            alt={extractedPost.caption}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="%23ddd" width="400" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999">Image not available</text></svg>';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-600 mb-1 block">
                                        Author
                                    </label>
                                    <a
                                        href={extractedPost.authorUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-lg font-bold text-purple-600 hover:text-purple-700 flex items-center gap-2"
                                    >
                                        @{extractedPost.username}
                                        <LinkIcon className="w-4 h-4" />
                                    </a>
                                </div>

                                {extractedPost.location && (
                                    <div>
                                        <label className="text-sm font-semibold text-gray-600 mb-1 block">
                                            Location
                                        </label>
                                        <div className="text-gray-800 flex items-center gap-1">
                                            <MapPin className="w-4 h-4 text-red-500" />
                                            {extractedPost.location}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-semibold text-gray-600 mb-1 block">
                                        Caption
                                    </label>
                                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap">
                                        {extractedPost.caption || "No caption available"}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-gray-600 mb-1 block">
                                        Post URL
                                    </label>
                                    <a
                                        href={extractedPost.postUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 truncate"
                                    >
                                        <LinkIcon className="w-4 h-4 flex-shrink-0" />
                                        {extractedPost.postUrl}
                                    </a>
                                </div>

                                <div className="pt-4 border-t border-gray-200">
                                    <button className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center justify-center gap-2">
                                        <MapPin className="w-5 h-5" />
                                        Create Recommendation from Post
                                    </button>
                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                        AI will extract location from caption and image
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Extracted Profile */}
                {extractedProfile && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 animate-in fade-in duration-500">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <User className="w-6 h-6 text-purple-600" />
                            Extracted Profile
                        </h2>

                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Profile Picture */}
                            <div className="flex-shrink-0">
                                <img
                                    src={px(extractedProfile.profilePicture)}
                                    alt={extractedProfile.fullName}
                                    className="w-32 h-32 rounded-full border-4 border-purple-200 shadow-lg"
                                    onError={(e) => {
                                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle fill="%23ddd" cx="64" cy="64" r="64"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="48">?</text></svg>';
                                    }}
                                />
                            </div>

                            {/* Profile Info */}
                            <div className="flex-1 space-y-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-800">
                                        {extractedProfile.fullName}
                                    </h3>
                                    <a
                                        href={extractedProfile.profileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-purple-600 hover:text-purple-700 flex items-center gap-1 mt-1"
                                    >
                                        @{extractedProfile.username}
                                        <LinkIcon className="w-4 h-4" />
                                    </a>
                                </div>

                                {/* Stats */}
                                <div className="flex gap-6">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-gray-800">
                                            {extractedProfile.postsCount}
                                        </div>
                                        <div className="text-sm text-gray-600">Posts</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-gray-800">
                                            {extractedProfile.followersCount}
                                        </div>
                                        <div className="text-sm text-gray-600">Followers</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-gray-800">
                                            {extractedProfile.followingCount}
                                        </div>
                                        <div className="text-sm text-gray-600">Following</div>
                                    </div>
                                </div>

                                {/* Bio */}
                                {extractedProfile.bio && (
                                    <div>
                                        <label className="text-sm font-semibold text-gray-600 mb-1 block">
                                            Bio
                                        </label>
                                        <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                                            {extractedProfile.bio}
                                        </p>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-200">
                                    <button className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg hover:shadow-xl font-semibold">
                                        Save Profile
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scraped Account Posts */}
                {accountData && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 animate-in fade-in duration-500">
                        {/* Account Header */}
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
                            {accountData.profilePicture && (
                                <img
                                    src={px(accountData.profilePicture)}
                                    alt={accountData.fullName}
                                    className="w-20 h-20 rounded-full border-4 border-orange-200 shadow-lg"
                                    onError={(e) => {
                                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle fill="%23ddd" cx="40" cy="40" r="40"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="32">?</text></svg>';
                                    }}
                                />
                            )}
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    <Grid3X3 className="w-6 h-6 text-orange-600" />
                                    {accountData.fullName || `@${accountData.username}`}
                                </h2>
                                <a
                                    href={`https://www.instagram.com/${accountData.username}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:text-orange-700 flex items-center gap-1 mt-1"
                                >
                                    @{accountData.username}
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                    <span><strong>{accountData.postsCount}</strong> posts</span>
                                    <span><strong>{accountData.followersCount}</strong> followers</span>
                                    <span><strong>{accountData.followingCount}</strong> following</span>
                                </div>
                            </div>
                            <div className="text-right flex flex-col gap-1">
                                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl font-bold text-lg">
                                    {accountData.totalScraped} posts scraped
                                </div>
                                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1.5 rounded-xl font-semibold text-sm">
                                    {accountData.totalMedia} total media items
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {new Date(accountData.scrapedAt).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setAccountFilter('all')}
                                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${accountFilter === 'all'
                                    ? 'bg-gray-800 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                All ({accountData.posts.length})
                            </button>
                            <button
                                onClick={() => setAccountFilter('post')}
                                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-1.5 ${accountFilter === 'post'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <ImageIcon className="w-4 h-4" />
                                Posts ({accountData.posts.filter(p => p.type === 'post').length})
                            </button>
                            <button
                                onClick={() => setAccountFilter('reel')}
                                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-1.5 ${accountFilter === 'reel'
                                    ? 'bg-pink-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <Film className="w-4 h-4" />
                                Reels ({accountData.posts.filter(p => p.type === 'reel').length})
                            </button>
                        </div>

                        {/* Posts List — each post shows all its media */}
                        <div className="space-y-6">
                            {filteredPosts.map((post, postIndex) => (
                                <div key={post.shortcode} className="border border-gray-200 rounded-xl overflow-hidden hover:border-orange-300 transition-colors">
                                    {/* Post header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-gray-400">#{postIndex + 1}</span>
                                            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${post.type === 'reel'
                                                ? 'bg-pink-100 text-pink-700'
                                                : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {post.type === 'reel' ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                                                {post.type === 'reel' ? 'Reel' : 'Post'}
                                                {post.isCarousel && ' • Carousel'}
                                            </div>
                                            <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                                {post.media.length} media {post.media.length === 1 ? 'item' : 'items'}
                                            </span>
                                            {post.location && (
                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-red-400" />
                                                    {post.location}
                                                </span>
                                            )}
                                        </div>
                                        <a
                                            href={post.postUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 font-medium"
                                        >
                                            Open on Instagram
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>

                                    {/* Media grid — show ALL media for this post */}
                                    <div className="p-3">
                                        <div className={`flex gap-2 overflow-x-auto pb-2 ${post.media.length === 1 ? 'justify-center' : ''}`} style={{ scrollBehavior: 'smooth' }}>
                                            {post.media.map((mediaItem, mediaIndex) => (
                                                <div
                                                    key={mediaIndex}
                                                    className={`flex-shrink-0 relative rounded-lg overflow-hidden bg-gray-100 ${post.media.length === 1 ? 'w-full max-w-md' : 'w-64'
                                                        }`}
                                                    style={{ aspectRatio: post.media.length === 1 ? 'auto' : '1' }}
                                                >
                                                    {mediaItem.type === 'video' ? (
                                                        <video
                                                            src={px(mediaItem.url)}
                                                            controls
                                                            preload="metadata"
                                                            className="w-full h-full object-cover"
                                                            style={{ maxHeight: post.media.length === 1 ? '500px' : undefined }}
                                                        />
                                                    ) : (
                                                        <img
                                                            src={px(mediaItem.url)}
                                                            alt={`${post.altText || 'Media'} ${mediaIndex + 1}`}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                            style={{ maxHeight: post.media.length === 1 ? '500px' : undefined }}
                                                            onError={(e) => {
                                                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="%23f3f4f6" width="256" height="256"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="14">Failed to load</text></svg>';
                                                            }}
                                                        />
                                                    )}
                                                    {/* Media index badge */}
                                                    {post.media.length > 1 && (
                                                        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                                                            {mediaIndex + 1}/{post.media.length}
                                                        </div>
                                                    )}
                                                    {/* Video badge */}
                                                    {mediaItem.type === 'video' && (
                                                        <div className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1">
                                                            <Film className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Caption preview */}
                                    {post.caption && (
                                        <div className="px-4 pb-3">
                                            <p className="text-sm text-gray-600 line-clamp-2">
                                                {post.caption}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {filteredPosts.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <p>No {accountFilter === 'all' ? 'posts' : accountFilter + 's'} found.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* How to Use */}
                {!extractedPost && !extractedProfile && !accountData && !error && !loading && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">How to Use</h2>

                        {activeTab === 'post' ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Find a Post</h3>
                                        <p className="text-gray-600">
                                            Open Instagram and find any public post about a place you want to save
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Copy the URL</h3>
                                        <p className="text-gray-600">
                                            Tap the three dots → "Copy link" or copy from your browser
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Paste & Extract</h3>
                                        <p className="text-gray-600">
                                            Paste the URL above and click Extract to import the post data
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'profile' ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Find a Profile</h3>
                                        <p className="text-gray-600">
                                            Know the username of a travel blogger or creator you want to follow
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Enter Username or URL</h3>
                                        <p className="text-gray-600">
                                            Type just the username (e.g., "nasa") or paste the full profile URL
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Extract Profile</h3>
                                        <p className="text-gray-600">
                                            Get profile picture, bio, follower count, and more instantly!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Enter a Public Account</h3>
                                        <p className="text-gray-600">
                                            Type in a username (e.g., "natgeo") or paste a full profile URL
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Wait for Scraping</h3>
                                        <p className="text-gray-600">
                                            The scraper will scroll through the profile grid and collect all posts and reels. This can take 30–60 seconds.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 mb-1">Browse & Filter</h3>
                                        <p className="text-gray-600">
                                            View all posts in a grid with thumbnails. Filter between posts and reels. Click any item to open it on Instagram.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-900">
                                <strong>✨ No login required!</strong> This works with any public Instagram {activeTab === 'post' ? 'post' : activeTab === 'profile' ? 'profile' : 'account'},
                                even from personal accounts. {activeTab === 'post' && 'Our AI will extract location information from the caption and image automatically.'}
                                {activeTab === 'account' && 'The scraper loads the public profile page and collects all visible posts and reels.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Instagram;
