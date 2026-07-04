<template>
  <main class="container section not-found-page">
    <section class="panel not-found-panel">
      <p class="not-found-code">404</p>
      <h1>页面不存在</h1>
      <p class="not-found-text">
        你访问的链接可能已失效，或者地址输入有误。
      </p>
      <div class="card-actions">
        <RouterLink class="btn btn-primary" to="/">返回首页</RouterLink>
        <RouterLink class="btn btn-ghost" to="/solutions">去题解管理</RouterLink>
      </div>
    </section>
  </main>
</template>
