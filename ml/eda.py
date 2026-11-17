import pandas as pd, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt, seaborn as sns
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score, silhouette_score
import json
BLUE="#2563EB"; sns.set_theme(style="whitegrid")
df=pd.read_csv("data/processed/resumes_clean.csv")
F="reports/figures/"

order=df.Category.value_counts()
plt.figure(figsize=(9,7)); sns.barplot(y=order.index,x=order.values,color=BLUE)
plt.title("Resumes per category (class imbalance)"); plt.xlabel("count"); plt.tight_layout(); plt.savefig(F+"01_class_distribution.png",dpi=140); plt.close()

plt.figure(figsize=(8,4.5)); sns.histplot(df.n_words.clip(upper=2500),bins=40,color=BLUE)
plt.title("Resume length (words)"); plt.tight_layout(); plt.savefig(F+"02_length_hist.png",dpi=140); plt.close()

# clustering (unsupervised) on TF-IDF + SVD
vec=TfidfVectorizer(stop_words="english",max_features=20000,min_df=3,sublinear_tf=True)
X=vec.fit_transform(df.text_no_title)
Z=TruncatedSVD(100,random_state=42).fit_transform(X); Z/=np.linalg.norm(Z,axis=1,keepdims=True)+1e-9
res=[]
for k in [8,12,16,24,32]:
    km=KMeans(k,n_init=5,random_state=42).fit(Z)
    res.append(dict(k=k,silhouette=float(silhouette_score(Z,km.labels_,sample_size=1500,random_state=42)),
        ARI=float(adjusted_rand_score(df.Category,km.labels_)),NMI=float(normalized_mutual_info_score(df.Category,km.labels_))))
r=pd.DataFrame(res); print(r)
r.to_csv("reports/clustering_metrics.csv",index=False)
fig,ax=plt.subplots(figsize=(7,4)); ax.plot(r.k,r.silhouette,marker="o",color=BLUE,label="Silhouette"); ax.plot(r.k,r.NMI,marker="o",color="#F97316",label="NMI vs true category")
ax.set_xlabel("k"); ax.legend(); ax.set_title("KMeans on resume vectors"); plt.tight_layout(); plt.savefig(F+"03_clustering.png",dpi=140); plt.close()

from sklearn.decomposition import PCA
P=PCA(2,random_state=42).fit_transform(Z)
top=order.index[:8]; m=df.Category.isin(top)
plt.figure(figsize=(8,6)); sns.scatterplot(x=P[m,0],y=P[m,1],hue=df.Category[m],s=22,palette="tab10"); plt.title("Resume map (PCA, top 8 categories)")
plt.legend(fontsize=7,bbox_to_anchor=(1,1)); plt.tight_layout(); plt.savefig(F+"04_pca_map.png",dpi=140); plt.close()
print("done")
