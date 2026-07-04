<script setup>
const friends = [
  {
    name: "Teslong Blog",
    url: "https://www.teslongxiao.cn/",
    description: "teslongxiao的博客",
    avatar: "/images/xzl.jpg"
  },
  {
    name: "Silencer76",
    url: "http://www.silencer76.com/",
    description: "76的编程小屋",
    avatar: "/images/Silencer76.jpg"
  }
];
</script>

<template>
  <main class="container section">
    <h1>友链</h1>
    <p class="section-desc">交换友链请邮件联系</p>
    
    <div class="card-grid">
      <a 
        v-for="friend in friends" 
        :key="friend.url"
        :href="friend.url"
        target="_blank"
        rel="noopener noreferrer"
        class="card friend-card"
      >
        <div class="friend-avatar">
          <img v-if="friend.avatar" :src="friend.avatar" :alt="friend.name" />
          <span v-else class="avatar-placeholder">{{ friend.name.charAt(0) }}</span>
        </div>
        <div class="friend-info">
          <h3>{{ friend.name }}</h3>
          <p>{{ friend.description }}</p>
        </div>
      </a>
    </div>
  </main>
</template>

<style scoped>
.section-desc {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.friend-card:hover {
  transform: translateY(-2px);
}

.friend-avatar {
  flex-shrink: 0;
}

.friend-avatar img,
.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: white;
  font-weight: bold;
  font-size: 1.25rem;
}

.friend-info h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.friend-info p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}
</style>