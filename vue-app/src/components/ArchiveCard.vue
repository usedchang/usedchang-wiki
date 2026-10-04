<script setup>
import { computed } from "vue";
import { formatPostDate, toPostDateTimeAttr } from "../utils/postFilter";
import { getPostKindTemplate } from "../utils/postStorage";

/**
 * 归档页卡片。题解归档与知识归档原先各写了一份几乎相同的卡片模板，
 * 差异只有「摘要兜底文案」「右上角角标」「底部操作」，这里用 props + slot 收敛。
 */
const props = defineProps({
  post: { type: Object, required: true },
  /** 阅读链接地址；知识页的内置文档指向专题页而非 /posts/:id */
  readPath: { type: String, required: true },
  /** 阅读链接文案，如「阅读题解」「阅读笔记」 */
  readLabel: { type: String, default: "阅读全文" },
  /** 摘要为空时的兜底文案；不传则按文章类型取默认值 */
  fallbackSummary: { type: String, default: "" },
  /** 右上角角标；不传则显示标签数量或类型名 */
  metaLabel: { type: String, default: "" },
  /** 传入后卡片右上角改为可点击的标签按钮 */
  selectedTag: { type: String, default: "" },
  /** 内置文档等没有时间戳的条目可以直接隐藏日期，避免出现「日期未知」 */
  hideDate: { type: Boolean, default: false },
});

const emit = defineEmits(["select-tag"]);

const template = computed(() => getPostKindTemplate(props.post?.kind));

const displayDate = computed(() => formatPostDate(props.post));
const dateTimeAttr = computed(() => toPostDateTimeAttr(props.post));

const summary = computed(
  () => props.post?.summary || props.fallbackSummary || template.value.defaultSummary
);

const tags = computed(() =>
  (Array.isArray(props.post?.tags) ? props.post.tags : []).slice(0, 4)
);

const badge = computed(() => {
  if (props.metaLabel) return props.metaLabel;
  const count = props.post?.tags?.length || 0;
  return count ? `${count} 个标签` : template.value.cardFallback;
});
</script>

<template>
  <article class="solution-archive-card">
    <div class="archive-card-topline">
      <template v-if="!hideDate">
        <time v-if="dateTimeAttr" :datetime="dateTimeAttr">{{ displayDate }}</time>
        <time v-else>{{ displayDate }}</time>
      </template>
      <span>{{ badge }}</span>
    </div>

    <h2>
      <RouterLink :to="readPath">{{ post.title || template.untitled }}</RouterLink>
    </h2>

    <p class="archive-card-summary">{{ summary }}</p>

    <div class="archive-card-footer">
      <div class="tag-list archive-card-tags">
        <button
          v-for="tag in tags"
          :key="tag"
          type="button"
          @click="emit('select-tag', tag)"
        >
          {{ tag }}
        </button>
      </div>
      <div class="card-actions">
        <RouterLink class="archive-read-link" :to="readPath">
          {{ readLabel }} <span aria-hidden="true">→</span>
        </RouterLink>
        <slot name="actions" />
      </div>
    </div>
  </article>
</template>
