<template>
  <div class="tag-container-settings">
    <div v-for="tag in dynamicTags" :key="tag.id || tag.agency" class="agency-chip">
      <span>{{ tag.agency }}</span>
      <button
        type="button"
        class="agency-chip-remove"
        :aria-label="`Hapus agency ${tag.agency}`"
        @click="handleClose(tag)"
      >
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <div v-if="inputVisible" class="agency-input-wrap">
      <label for="new-agency-input" class="sr-only">Nama agency baru</label>
      <el-input
        id="new-agency-input"
        ref="saveTagInput"
        v-model="inputValue"
        class="input-new-tag"
        placeholder="Nama agency"
        aria-label="Nama agency baru"
        @keyup.enter.native="handleInputConfirm"
        @blur="handleInputConfirm"
      />
    </div>
    <el-button v-else class="button-new-tag" @click="showInput">+ New Tag</el-button>
  </div>
</template>

<script>
import {
  create as createAgency,
  fetchAll as fetchAgencies,
  remove as removeAgency
} from "../../services/api/agencyApi";

export default {
  name: "AgencyTagManager",
  data() {
    return {
      dynamicTags: [],
      inputVisible: false,
      inputValue: ""
    };
  },
  created() {
    this.loadAgencies();
  },
  methods: {
    loadAgencies() {
      fetchAgencies()
        .then((rows) => {
          this.dynamicTags = rows.map((row) => ({
            id: row.id,
            agency: row.agency
          }));
        })
        .catch(() => {
          this.$message.error("Failed loading agencies");
        });
    },
    handleClose(tag) {
      const idx = this.dynamicTags.indexOf(tag);
      if (idx === -1) {
        return;
      }

      removeAgency(tag.agency)
        .then(() => {
          this.dynamicTags.splice(idx, 1);
        })
        .catch(() => {
          this.$message.error("Failed deleting agency");
        });
    },
    showInput() {
      this.inputVisible = true;
      this.$nextTick(() => {
        if (this.$refs.saveTagInput && this.$refs.saveTagInput.$refs.input) {
          this.$refs.saveTagInput.$refs.input.focus();
        }
      });
    },
    handleInputConfirm() {
      const trimmed = this.inputValue.trim();
      this.inputVisible = false;
      this.inputValue = "";

      if (!trimmed) {
        return;
      }

      createAgency(trimmed)
        .then((created) => {
          this.dynamicTags.push({
            id: created && created.id ? created.id : undefined,
            agency: created && created.agency ? created.agency : trimmed
          });
        })
        .catch(() => {
          this.$message.error("Failed adding agency");
        });
    }
  }
};
</script>

<style>
.tag-container-settings {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.agency-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 6px 0 14px;
  border-radius: var(--radius-pill);
  background-color: var(--accent-soft-bg);
  color: var(--accent-soft-text);
  border: 1px solid var(--accent-soft-border);
  font-size: var(--text-sm);
  font-weight: 600;
}

.agency-chip-remove {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--accent-soft-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.agency-chip-remove:hover {
  background-color: var(--bg-surface);
  color: var(--danger-text);
}

.button-new-tag {
  min-height: 44px;
  border-radius: var(--radius-pill) !important;
  background: var(--bg-surface-subtle) !important;
  border: 1px solid var(--border-input) !important;
  color: var(--text-primary) !important;
  font-weight: 600;
}

.button-new-tag:hover,
.button-new-tag:focus {
  border-color: var(--accent-primary) !important;
  color: var(--accent-primary) !important;
}

.agency-input-wrap {
  min-width: 150px;
}
</style>
