<template>
  <div class="tag-container-settings">
    <el-tag
      v-for="tag in dynamicTags"
      :key="tag.id || tag.agency"
      closable
      :disable-transitions="false"
      @close="handleClose(tag)"
    >
      {{ tag.agency }}
    </el-tag>
    <el-input
      v-if="inputVisible"
      ref="saveTagInput"
      v-model="inputValue"
      class="input-new-tag"
      size="mini"
      @keyup.enter.native="handleInputConfirm"
      @blur="handleInputConfirm"
    />
    <el-button v-else class="button-new-tag" size="small" @click="showInput"> + New Tag </el-button>
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
  width: 50%;
}

.tag-container-settings .el-tag {
  background-color: transparent;
  border-color: var(--green-theme);
  color: var(--green-theme);
  border-radius: 100px;
}

.el-tag .el-tag__close {
  color: var(--green-theme-30);
}

.el-tag .el-tag__close:hover {
  color: var(--green-theme);
  background-color: transparent;
}

.el-tag + .el-tag {
  margin-left: 10px;
  margin-bottom: 10px;
}

.button-new-tag {
  margin-left: 10px;
  height: 32px;
  line-height: 30px;
  padding-top: 0;
  padding-bottom: 0;
}

.input-new-tag {
  width: 90px;
  margin-left: 10px;
  margin-bottom: 10px;
  vertical-align: bottom;
}

.tag-container-settings .el-button--mini,
.tag-container-settings .el-button--small {
  border-radius: 100px;
}

.tag-container-settings .el-button {
  background: transparent;
  border: 1px solid var(--text-color);
  color: var(--text-color);
  transition: 0.5s;
}

.tag-container-settings .el-button:hover,
.tag-container-settings .el-button:focus {
  background: transparent;
  border: 1px solid var(--green-theme);
  color: var(--green-theme);
}

.tag-container-settings .el-input__inner {
  border-radius: 100px;
}

.tag-container-settings .el-input .el-input__inner {
  box-shadow: none;
  border: 1px solid var(--green-theme-30);
}

.tag-container-settings .el-input .el-input__inner:hover,
.tag-container-settings .el-input .el-input__inner:focus {
  border-color: var(--green-theme);
}

@media screen and (max-width: 992px) {
  .tag-container-settings {
    width: 50%;
  }
}
</style>
